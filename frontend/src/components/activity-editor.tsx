'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActivityBackLink } from './activity-back-link';
import { LocationPicker } from './location-picker';

type Draft = { id?: number; status: string; editable: boolean; revision?: string; name: string; description: string | null; startAt: string | null; endAt: string | null; location: string | null; latitude: number | null; longitude: number | null; capacity: number | null; points: number; requiresCheckout: boolean };
type Assignment = { key: string; userId: string; name: string; description: string; type: 'leader' | 'member'; startAt: string; endAt: string };
const empty: Draft = { status: 'draft', editable: true, name: '', description: '', startAt: null, endAt: null, location: '', latitude: null, longitude: null, capacity: null, points: 0, requiresCheckout: false };
const localTime = (value: string | null) => value ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16) : '';
const utcTime = (value: string) => value ? new Date(`${value}+07:00`).toISOString() : null;

async function readDraft(id: number | null, signal?: AbortSignal): Promise<Draft> {
  if (!id) return { ...empty };
  const response = await fetch(`/api/backend/activities/${id}/editor`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Không thể tải hoạt động hoặc bạn không có quyền truy cập.');
  return response.json();
}
function validAssignments(value: unknown): value is { v: 1; assignments: Assignment[] } {
  return !!value && typeof value === 'object' && 'v' in value && value.v === 1 && 'assignments' in value && Array.isArray(value.assignments) && value.assignments.every((item: unknown) => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown>;
    return ['key', 'userId', 'name', 'description', 'startAt', 'endAt'].every((key) => typeof row[key] === 'string') && ['leader', 'member'].includes(row.type as string);
  });
}

export function ActivityEditor({ actorId, id }: { actorId: number; id: number | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState('information');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [accounts, setAccounts] = useState<{ id_nguoi_dung: number; ten_dang_nhap: string; ho_ten: string }[]>([]);
  const [search, setSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [error, setError] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [assignmentDirty, setAssignmentDirty] = useState(false);
  const [storageConflict, setStorageConflict] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const ready = draft !== null;
  useEffect(() => { if (ready) heading.current?.focus({ preventScroll: true }); }, [ready, id]);
  const key = (activityId: number | null | undefined) => `cm:assignment-draft:${actorId}:${activityId ?? 'new'}`;
  useEffect(() => {
    const controller = new AbortController();
    void readDraft(id, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setDraft(data);
      try {
        const raw = data.editable ? localStorage.getItem(`cm:assignment-draft:${actorId}:${id ?? 'new'}`) : null;
        if (raw) {
          const saved: unknown = JSON.parse(raw);
          if (!validAssignments(saved)) throw new Error();
          setAssignments(saved.assignments);
        }
      } catch { setError('Không thể đọc phân công tạm trong trình duyệt.'); }
    }).catch(() => { if (!controller.signal.aborted) setError('Không thể tải hoạt động hoặc bạn không có quyền truy cập.'); });
    return () => controller.abort();
  }, [actorId, id]);
  useEffect(() => {
    if (tab !== 'assignments') return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/backend/activities/assignees?search=${encodeURIComponent(search)}`, { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) { setAccounts(data); setLookupError(''); }
      }).catch(() => { if (!controller.signal.aborted) setLookupError('Không thể tải người phụ trách.'); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, tab]);
  useEffect(() => {
    function changed(event: StorageEvent) {
      if (event.key === `cm:assignment-draft:${actorId}:${draft?.id ?? id ?? 'new'}`) {
        setStorageConflict(true); setError('Phân công tạm đã thay đổi ở tab khác. Tải lại trang trước khi lưu tiếp.');
      }
    }
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [actorId, draft?.id, id]);
  useEffect(() => {
    if (!dirty && !assignmentDirty) return;
    function unload(event: BeforeUnloadEvent) { event.preventDefault(); }
    function navigate(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const destination = new URL(link.href);
      if (!['http:', 'https:'].includes(destination.protocol) || (destination.origin === location.origin && destination.pathname === location.pathname && destination.search === location.search)) return;
      if (!window.confirm('Bạn có thay đổi chưa lưu. Rời trang?')) { event.preventDefault(); event.stopPropagation(); }
    }
    window.addEventListener('beforeunload', unload); document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [dirty, assignmentDirty]);

  function storeAssignments(activityId = draft?.id) {
    if (storageConflict) throw new Error('Assignment conflict.');
    localStorage.setItem(key(activityId), JSON.stringify({ v: 1, assignments }));
    setAssignmentDirty(false);
  }
  function change(field: keyof Draft, value: Draft[keyof Draft]) { setDraft((current) => current ? { ...current, [field]: value } : current); setDirty(true); setMessage(''); }
  function changeAssignment(index: number, field: keyof Assignment, value: string) { setAssignments((current) => current.map((row, i) => i === index ? { ...row, [field]: value } : row)); setAssignmentDirty(true); }

  async function save() {
    if (!draft || !draft.editable || saving || storageConflict) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const { name, description, startAt, endAt, location, latitude, longitude, capacity, points, requiresCheckout } = draft;
      const response = await fetch(`/api/backend/activities${draft.id ? `/${draft.id}` : ''}`, { method: draft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, startAt, endAt, location, latitude, longitude, capacity, points, requiresCheckout, ...(draft.id ? { revision: draft.revision } : {}) }) });
      if (!response.ok) { const body = await response.json(); setError(body.message ?? 'Không thể lưu hoạt động.'); return; }
      const result = await response.json() as { id: number };
      const saved = await readDraft(result.id);
      setDraft(saved); setDirty(false); setMessage('Đã lưu hoạt động nháp.');
      try {
        storeAssignments(result.id);
        if (!draft.id) { localStorage.removeItem(key(null)); router.replace(`/system?view=activities&editor=${result.id}`); }
      } catch { setError('Hoạt động đã được lưu; không thể lưu phân công tạm. Hãy giữ trang này và thử lưu tạm lại.'); }
    } catch { setError('Không thể kết nối dịch vụ. Vui lòng tải lại trước khi thử lưu lại.'); }
    finally { setSaving(false); }
  }
  if (!draft) return <div className="container system-workspace"><h1>{id ? 'Chỉnh sửa hoạt động' : 'Tạo hoạt động'}</h1>{error ? <p role="alert">{error}</p> : <p role="status">Đang tải hoạt động…</p>}</div>;
  const disabled = !draft.editable || saving || storageConflict;
  return <div className="container system-workspace activity-editor">
    <ActivityBackLink />
    <div className="workspace-heading"><h1 ref={heading} tabIndex={-1}>{id ? 'Chỉnh sửa hoạt động' : 'Tạo hoạt động'}</h1>{(dirty || assignmentDirty) && <span className="status-label">Chưa lưu</span>}</div>
    {!draft.editable && <p className="service-notice">Hoạt động đã công bố chỉ được xem trong giai đoạn này. Phân công đã công bố không được chỉnh sửa.</p>}
    <div className="workspace-tabs" role="group" aria-label="Nội dung hoạt động">{[['information', 'Thông tin chung'], ['schedule', 'Lịch và địa điểm'], ['assignments', 'Phân công']].map(([value, label]) => <button type="button" className="button button-outline" key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}</div>
    <form noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={disabled} className="surface editor-fields">
        <div hidden={tab !== 'information'} className="editor-grid">
          <div className="field full-width"><label htmlFor="activity-name">Tên hoạt động</label><input id="activity-name" value={draft.name} required maxLength={255} onChange={(event) => change('name', event.target.value)} /></div>
          <div className="field full-width"><label htmlFor="activity-description">Mô tả</label><textarea id="activity-description" rows={4} value={draft.description ?? ''} maxLength={10000} onChange={(event) => change('description', event.target.value)} /></div>
          <div className="field"><label htmlFor="activity-capacity">Giới hạn đăng ký</label><input id="activity-capacity" type="number" min={1} max={4294967295} value={draft.capacity ?? ''} onChange={(event) => change('capacity', event.target.value ? Number(event.target.value) : null)} /></div>
          <div className="field"><label htmlFor="activity-points">Điểm hoạt động</label><input id="activity-points" type="number" min={0} max={2147483647} value={draft.points} onChange={(event) => change('points', Number(event.target.value))} /></div>
          <div className="field full-width"><label htmlFor="activity-plan">Kế hoạch hoạt động</label><button id="activity-plan" className="button button-outline" type="button" disabled>Chọn tệp kế hoạch</button><p className="field-hint">Tải kế hoạch chưa khả dụng.</p></div>
        </div>
        <div hidden={tab !== 'schedule'} className="editor-grid">
          <div className="field"><label htmlFor="activity-start">Bắt đầu (giờ Việt Nam)</label><input id="activity-start" type="datetime-local" value={localTime(draft.startAt)} onChange={(event) => change('startAt', utcTime(event.target.value))} /></div>
          <div className="field"><label htmlFor="activity-end">Kết thúc (giờ Việt Nam)</label><input id="activity-end" type="datetime-local" value={localTime(draft.endAt)} onChange={(event) => change('endAt', utcTime(event.target.value))} /></div>
          <div className="field full-width"><label htmlFor="activity-location">Địa điểm</label><input id="activity-location" maxLength={2000} value={draft.location ?? ''} onChange={(event) => { const location = event.target.value; setDraft((current) => current ? { ...current, location, latitude: null, longitude: null } : current); setLocationSearch(location); setDirty(true); setMessage('Địa điểm đã thay đổi. Ghim lại vị trí trước khi lưu tọa độ.'); }} /><p className="field-hint">Nhập địa chỉ kèm tỉnh/thành để bản đồ tự tìm vị trí.</p></div>
          {tab === 'schedule' && <LocationPicker latitude={draft.latitude} longitude={draft.longitude} searchQuery={locationSearch} disabled={disabled} onSelect={(location) => { setDraft((current) => current ? { ...current, location, latitude: null, longitude: null } : current); setDirty(true); setMessage('Địa điểm đã thay đổi. Ghim lại vị trí trước khi lưu tọa độ.'); }} onChange={(point) => { setDraft((current) => current ? { ...current, latitude: point?.lat ?? null, longitude: point?.lng ?? null } : current); setLocationSearch(''); setDirty(true); setMessage(''); }} />}
          <label className="checkbox-label"><input type="checkbox" checked={draft.requiresCheckout} onChange={(event) => change('requiresCheckout', event.target.checked)} />Bắt buộc Checkout</label>
        </div>
        <div hidden={tab !== 'assignments'} className="assignment-editor">
          <p className="field-hint">Phân công tạm chỉ lưu trong trình duyệt này, chưa đồng bộ sang thiết bị khác.</p>
          <div className="field"><label htmlFor="assignee-search">Tìm người phụ trách</label><input id="assignee-search" type="search" maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          {lookupError && <p role="alert">{lookupError}</p>}
          {assignments.map((row, index) => <section className="assignment-row" key={row.key}><h2>Nhiệm vụ {index + 1}</h2><div className="editor-grid">
            <div className="field"><label htmlFor={`task-name-${row.key}`}>Tên nhiệm vụ</label><input id={`task-name-${row.key}`} maxLength={255} value={row.name} onChange={(event) => changeAssignment(index, 'name', event.target.value)} /></div>
            <div className="field"><label htmlFor={`task-user-${row.key}`}>Người phụ trách</label><select id={`task-user-${row.key}`} value={row.userId} onChange={(event) => changeAssignment(index, 'userId', event.target.value)}><option value="">Chọn người phụ trách</option>{row.userId && !accounts.some((account) => String(account.id_nguoi_dung) === row.userId) && <option value={row.userId}>Tài khoản #{row.userId}</option>}{accounts.map((account) => <option value={account.id_nguoi_dung} key={account.id_nguoi_dung}>{account.ten_dang_nhap} — {account.ho_ten}</option>)}</select></div>
            <div className="field"><label htmlFor={`task-type-${row.key}`}>Loại nhiệm vụ</label><select id={`task-type-${row.key}`} value={row.type} onChange={(event) => changeAssignment(index, 'type', event.target.value)}><option value="member">Thành viên</option><option value="leader">Trưởng BTC</option></select></div>
            <div className="field"><label htmlFor={`task-description-${row.key}`}>Mô tả nhiệm vụ</label><input id={`task-description-${row.key}`} value={row.description} onChange={(event) => changeAssignment(index, 'description', event.target.value)} /></div>
            <div className="field"><label htmlFor={`task-start-${row.key}`}>Bắt đầu nhiệm vụ</label><input id={`task-start-${row.key}`} type="datetime-local" value={row.startAt} onChange={(event) => changeAssignment(index, 'startAt', event.target.value)} /></div>
            <div className="field"><label htmlFor={`task-end-${row.key}`}>Kết thúc nhiệm vụ</label><input id={`task-end-${row.key}`} type="datetime-local" value={row.endAt} onChange={(event) => changeAssignment(index, 'endAt', event.target.value)} /></div>
          </div><button className="text-button" type="button" onClick={() => { setAssignments((current) => current.filter((item) => item.key !== row.key)); setAssignmentDirty(true); }}>Xóa nhiệm vụ</button></section>)}
          <div className="activity-card-actions"><button className="button button-outline" type="button" onClick={() => { setAssignments((current) => [...current, { key: crypto.randomUUID(), userId: '', name: '', description: '', type: 'member', startAt: '', endAt: '' }]); setAssignmentDirty(true); }}>Thêm nhiệm vụ</button><button className="button button-outline" type="button" onClick={() => { try { storeAssignments(); setMessage('Đã lưu phân công tạm trong trình duyệt.'); } catch { setError('Không thể lưu phân công tạm. Kiểm tra dung lượng hoặc quyền lưu trữ của trình duyệt.'); } }}>Lưu tạm</button></div>
        </div>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <div className="activity-card-actions editor-actions"><button className="button button-primary" type="submit" disabled={disabled}>{saving ? 'Đang lưu…' : 'Lưu nháp'}</button><button className="button button-outline" type="button" disabled title="Công bố đang chờ chốt quy tắc phân công.">Công bố</button></div>
    </form>
  </div>;
}
