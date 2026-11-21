'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActivityBackLink } from './activity-back-link';
import { SelectField } from './select-field';
import { ActivityImageDialog } from './activity-media';
import { LocationPicker } from './location-picker';
import { useToast } from './toast';
import { assignmentKey, readAssignments, type Assignment } from '@/lib/activity-draft';

type Draft = { id?: number; status: string; editable: boolean; revision?: string; imageUrl?: string | null; imageName?: string | null; planUrl?: string | null; planName?: string | null; locationNote?: string | null; name: string; description: string | null; startAt: string | null; endAt: string | null; location: string | null; latitude: number | null; longitude: number | null; capacity: number | null; points: number; requiresCheckout: boolean };
const empty: Draft = { status: 'draft', editable: true, name: '', description: '', startAt: null, endAt: null, location: '', latitude: null, longitude: null, capacity: null, points: 0, requiresCheckout: false };
const localTime = (value: string | null) => value ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16) : '';
const utcTime = (value: string) => value ? new Date(`${value}+07:00`).toISOString() : null;

async function readDraft(id: number | null, signal?: AbortSignal): Promise<Draft> {
  if (!id) return { ...empty };
  const response = await fetch(`/api/backend/activities/${id}/editor`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Không thể tải hoạt động hoặc bạn không có quyền truy cập.');
  return response.json();
}
export function ActivityEditor({ actorId, id }: { actorId: number; id: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState('information');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [accounts, setAccounts] = useState<{ id_nguoi_dung: number; ten_dang_nhap: string; ho_ten: string }[]>([]);
  const [leaders, setLeaders] = useState<typeof accounts>([]);
  const [loadedSearch, setLoadedSearch] = useState<string>();
  const [search, setSearch] = useState('');
  const lookupPending = loadedSearch !== search;
  const [locationSearch, setLocationSearch] = useState('');
  const [error, setError] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pointsInput, setPointsInput] = useState('0');
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const leaveTarget = useRef<URL | null>(null);
  const leaveConfirmed = useRef(false);
  const [assignmentDirty, setAssignmentDirty] = useState(false);
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [plan, setPlan] = useState<File | null>(null);
  const [removePlan, setRemovePlan] = useState(false);
  const [removeFile, setRemoveFile] = useState<'image' | 'plan'>();
  const removeDialog = useRef<HTMLDialogElement>(null);
  const publishDialog = useRef<HTMLDialogElement>(null);
  const planInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const imageDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);
  const [storageConflict, setStorageConflict] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const ready = draft !== null;
  useEffect(() => { if (ready) heading.current?.focus({ preventScroll: true }); }, [ready, id]);
  useEffect(() => {
    const controller = new AbortController();
    void readDraft(id, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setDraft(data);
      setPointsInput(String(data.points));
      try {
        if (data.editable) setAssignments(readAssignments(actorId, id));
      } catch { setError('Không thể đọc phân công tạm trong trình duyệt.'); }
    }).catch(() => { if (!controller.signal.aborted) setError('Không thể tải hoạt động hoặc bạn không có quyền truy cập.'); });
    return () => controller.abort();
  }, [actorId, id]);
  useEffect(() => {
    if (tab !== 'assignments') return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const url = `/api/backend/activities/assignees?search=${encodeURIComponent(search)}`;
      const read = async (target: string) => {
        const response = await fetch(target, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error();
        return response.json();
      };
      void Promise.all([read(url), read(url + '&role=staff')]).then(([data, staff]) => {
        if (!controller.signal.aborted) { setAccounts(data); setLeaders(staff); setLookupError(''); setLoadedSearch(search); }
      }).catch(() => { if (!controller.signal.aborted) { setLookupError('Không thể tải người phụ trách.'); setLoadedSearch(search); } });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, tab]);
  useEffect(() => {
    function changed(event: StorageEvent) {
      if (event.key === assignmentKey(actorId, draft?.id ?? id)) {
        setStorageConflict(true); setError('Phân công tạm đã thay đổi ở tab khác. Tải lại trang trước khi lưu tiếp.');
      }
    }
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [actorId, draft?.id, id]);
  useEffect(() => {
    if (!dirty && !assignmentDirty && !image && !plan && !removeImage && !removePlan) return;
    function unload(event: BeforeUnloadEvent) { if (!leaveConfirmed.current) event.preventDefault(); }
    function navigate(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const destination = new URL(link.href);
      if (!['http:', 'https:'].includes(destination.protocol) || (destination.origin === location.origin && destination.pathname === location.pathname && destination.search === location.search)) return;
      event.preventDefault();
      event.stopPropagation();
      if (leaveDialog.current?.open) return;
      leaveTarget.current = destination;
      leaveDialog.current?.showModal();
    }
    window.addEventListener('beforeunload', unload); document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [dirty, assignmentDirty, image, plan, removeImage, removePlan]);

  function clearImageSelection() {
    setImage(null);
    if (imageInput.current) imageInput.current.value = '';
  }

  function storeAssignments(activityId = draft?.id) {
    if (storageConflict) throw new Error('Assignment conflict.');
    localStorage.setItem(assignmentKey(actorId, activityId), JSON.stringify({ v: 1, assignments }));
    setAssignmentDirty(false);
  }
  function change(field: keyof Draft, value: Draft[keyof Draft]) { setDraft((current) => current ? { ...current, [field]: value } : current); setDirty(true); setMessage(''); }
  function changeAssignment(index: number, field: keyof Assignment, value: string) { setAssignments((current) => current.map((row, i) => i === index ? { ...row, [field]: value } : row)); setAssignmentDirty(true); }

  async function save(publish = false) {
    if (!draft || !draft.editable || saving || storageConflict) return;
    if (assignments.filter(({ type }) => type === 'leader').length > 1) {
      setError('Mỗi hoạt động chỉ có thể có một nhiệm vụ Trưởng BTC.');
      return;
    }
    if (publish && !assignments.some(({ type }) => type === 'leader')) {
      toast('error', 'Chọn đúng một Trưởng BTC trước khi công bố.');
      return;
    }
    if (assignments.some((row) => !row.name.trim() || !row.userId)) {
      toast('error', 'Nhập tên và chọn người phụ trách cho từng nhiệm vụ.');
      return;
    }
    const points = pointsInput === '' ? 0 : Number(pointsInput);
    if (!/^\d*$/.test(pointsInput) || !Number.isSafeInteger(points) || points < 0 || points > 2147483647) {
      toast('error', 'Điểm hoạt động phải là số nguyên không âm hợp lệ.');
      return;
    }
    setSaving(true); setError(''); setMessage('');
    try {
      const { name, description, startAt, endAt, location, locationNote, latitude, longitude, capacity, requiresCheckout } = draft;
      const payload = JSON.stringify({ name, description: description?.trim() || null, startAt, endAt, location, locationNote, latitude, longitude, capacity, points, requiresCheckout,
        assignments: assignments.map((row) => ({ name: row.name, userId: Number(row.userId), type: row.type, description: row.description })),
        ...(removeImage && { removeImage }), ...(removePlan && { removePlan }), ...(publish && { publish }), ...(draft.id ? { revision: draft.revision } : {}) });
      const form = new FormData();
      if (image || plan) {
        form.set('draft', payload);
        if (image) form.set('image', image.file);
        if (plan) form.set('plan', plan);
      }
      const response = await fetch(`/api/backend/activities${draft.id ? `/${draft.id}` : ''}`, {
        method: draft.id ? 'PATCH' : 'POST', ...(image || plan ? {} : { headers: { 'Content-Type': 'application/json' } }), body: image || plan ? form : payload,
      });
      if (!response.ok) {
        const body = await response.json() as { message?: string };
        const message = body.message ?? 'Không thể lưu hoạt động.';
        toast('error', message);
        return;
      }
      const result = await response.json() as { id: number };
      if (publish) {
        try { localStorage.removeItem(assignmentKey(actorId, draft.id)); } catch { /* Publishing is already committed. */ }
        toast('success', 'Đã công bố hoạt động.');
        router.replace(`/system?view=published&activity=${result.id}`);
        router.refresh();
        return;
      }
      toast('success', image || plan ? 'Đã lưu bản nháp và tải tệp lên.' : 'Đã lưu hoạt động nháp.');
      const saved = await readDraft(result.id);
      setDraft(saved); setPointsInput(String(saved.points)); setDirty(false); clearImageSelection();
      setRemoveImage(false); setRemovePlan(false); setPlan(null);
      if (planInput.current) planInput.current.value = '';
      try {
        storeAssignments(result.id);
        if (!draft.id) { localStorage.removeItem(assignmentKey(actorId)); router.replace(`/system?view=activities&editor=${result.id}`); }
      } catch { toast('warning', 'Hoạt động đã được lưu. Hãy giữ trang này và chọn Nháp để thử lưu lại phân công.'); }
    } catch { toast('error', 'Không thể tải phản hồi từ dịch vụ. Vui lòng kiểm tra trạng thái hoạt động trước khi lưu lại.'); }
    finally { setSaving(false); }
  }
  if (!draft) return <div className="container system-workspace"><h1>{id ? 'Chỉnh sửa hoạt động' : 'Tạo hoạt động'}</h1>{error ? <p role="alert">{error}</p> : <p role="status">Đang tải hoạt động…</p>}</div>;
  const disabled = !draft.editable || saving || storageConflict;
  const previewImage = removeImage ? null : image?.url ?? draft.imageUrl;
  const imageName = previewImage ? image?.file.name ?? draft.imageName ?? 'Ảnh minh họa' : '';
  return <div className="container system-workspace activity-editor">
    <ActivityBackLink />
    <div className="workspace-heading"><h1 ref={heading} tabIndex={-1}>{id ? 'Chỉnh sửa hoạt động' : 'Tạo hoạt động'}</h1></div>
    <dialog ref={leaveDialog} className="surface face-guide" aria-labelledby="leave-activity-title">
      <h2 id="leave-activity-title">Hoạt động chưa được lưu</h2>
      <p>Nếu rời trang, các thay đổi chưa lưu có thể bị mất.</p>
      <div className="face-guide-actions">
        <button type="button" className="button button-outline" onClick={() => leaveDialog.current?.close()}>Tiếp tục chỉnh sửa</button>
        <button type="button" className="button button-primary" onClick={() => {
          const target = leaveTarget.current;
          leaveDialog.current?.close();
          if (!target) return;
          if (target.origin === location.origin) router.push(target.pathname + target.search + target.hash);
          else { leaveConfirmed.current = true; location.assign(target.href); }
        }}>Rời khỏi trang</button>
      </div>
    </dialog>
    {!draft.editable && <p className="service-notice">Hoạt động đã công bố chỉ được xem trong giai đoạn này. Phân công đã công bố không được chỉnh sửa.</p>}
    <div className="workspace-tabs" role="group" aria-label="Nội dung hoạt động">{[['information', 'Thông tin chung'], ['schedule', 'Lịch và địa điểm'], ['assignments', 'Phân công']].map(([value, label]) => <button type="button" className="button button-outline" key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}</div>
    <dialog ref={removeDialog} className="surface face-guide" aria-labelledby="remove-activity-file-title">
      <h2 id="remove-activity-file-title">{removeFile === 'image' ? 'Gỡ ảnh minh họa?' : 'Gỡ tệp kế hoạch?'}</h2>
      <p>Tệp đã lưu sẽ được gỡ sau khi bạn lưu thay đổi.</p>
      <div className="face-guide-actions">
        <button type="button" className="button button-outline" onClick={() => removeDialog.current?.close()}>Giữ lại</button>
        <button type="button" className="button button-primary" onClick={() => {
          if (removeFile === 'image') setRemoveImage(true);
          else setRemovePlan(true);
          removeDialog.current?.close();
        }}>Xác nhận gỡ</button>
      </div>
    </dialog>
    <dialog ref={publishDialog} className="surface face-guide" aria-labelledby="publish-activity-title">
      <h2 id="publish-activity-title">Công bố hoạt động?</h2>
      <p>Hoạt động sẽ mở đăng ký và người phụ trách sẽ nhận được thông báo phân công.</p>
      <div className="face-guide-actions">
        <button type="button" className="button button-outline" onClick={() => publishDialog.current?.close()}>Tiếp tục chỉnh sửa</button>
        <button type="button" className="button button-primary" onClick={() => { publishDialog.current?.close(); void save(true); }}>Xác nhận công bố</button>
      </div>
    </dialog>
    <ActivityImageDialog src={previewImage} dialog={imageDialog} label="Xem trước ảnh trong biểu mẫu" />
    <form noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className="activity-editor-heading">
        <h2>{tab === 'schedule' ? 'Lịch và địa điểm' : tab === 'assignments' ? 'Phân công' : 'Thông tin chung'}</h2>
      <div className="activity-card-actions activity-editor-buttons"><button className="button button-primary" type="submit" disabled={disabled}>{saving ? 'Đang lưu…' : 'Nháp'}</button><button className="button button-outline" type="button" disabled={disabled} onClick={() => {
        if (assignments.filter(({ type }) => type === 'leader').length !== 1) toast('error', 'Chọn đúng một Trưởng BTC trước khi công bố.');
        else publishDialog.current?.showModal();
      }}>Công bố</button></div>
      </div>
      <fieldset disabled={disabled} className="surface editor-fields">
        <div hidden={tab !== 'information'} className="editor-grid">
          <div className="field full-width"><label htmlFor="activity-name">Tên hoạt động</label><input id="activity-name" value={draft.name} required maxLength={255} onChange={(event) => change('name', event.target.value)} /></div>
          <div className="field full-width"><label htmlFor="activity-description">Mô tả</label><textarea id="activity-description" rows={4} value={draft.description ?? ''} maxLength={10000} onChange={(event) => change('description', event.target.value)} /></div>
          <div className="field"><label htmlFor="activity-capacity">Giới hạn đăng ký</label><input id="activity-capacity" type="number" min={1} max={4294967295} value={draft.capacity ?? ''} onChange={(event) => change('capacity', event.target.value ? Number(event.target.value) : null)} /></div>
          <div className="field"><label htmlFor="activity-points">Điểm hoạt động</label><input id="activity-points" inputMode="numeric" value={pointsInput} onChange={(event) => { setPointsInput(event.target.value); setDirty(true); }} /></div>
          <label className="checkbox-label full-width activity-checkout"><input type="checkbox" checked={draft.requiresCheckout} onChange={(event) => change('requiresCheckout', event.target.checked)} />Checkout</label>
          <div className="field full-width activity-image-field">
            <span className="field-label">Ảnh minh họa</span>
            <input ref={imageInput} id="activity-image" type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) {
                clearImageSelection();
                toast('error', 'Chọn ảnh JPG, PNG hoặc WebP hợp lệ, tối đa 10 MB.');
                return;
              }
              setRemoveImage(false);
              setImage({ file, url: URL.createObjectURL(file) });
            }} />
            <div className="activity-plan-upload activity-image-upload">
              <input aria-label="Tên tệp hình ảnh minh họa" readOnly value={imageName} placeholder="Chọn ảnh minh họa" title={imageName} />
              <button type="button" className="button button-outline" onClick={() => imageInput.current?.click()}>Tải lên</button>
              <button type="button" className="button button-outline" disabled={!previewImage} onClick={() => imageDialog.current?.showModal()}>Xem</button>
              <button type="button" className="button button-outline activity-danger" disabled={!previewImage} onClick={() => {
                if (image) clearImageSelection();
                else { setRemoveFile('image'); removeDialog.current?.showModal(); }
              }}>Gỡ ảnh</button>
            </div>
          </div>
          <div className="field full-width">
            <span className="field-label">Kế hoạch hoạt động</span>
            <input ref={planInput} type="file" hidden accept=".pdf,.xls,.xlsx" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) { setPlan(null); return; }
              if (!/\.(pdf|xls|xlsx)$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024) {
                event.target.value = '';
                toast('error', 'Chọn tệp PDF, XLS hoặc XLSX hợp lệ, tối đa 5 MB.');
                return;
              }
              setRemovePlan(false); setPlan(file);
            }} />
            <div className="activity-plan-upload">
              <input aria-label="Tên tệp kế hoạch" readOnly value={plan?.name ?? (removePlan ? '' : draft.planName ?? '')} placeholder="Chọn tệp kế hoạch" title={plan?.name ?? (removePlan ? '' : draft.planName ?? '')} />
              <button type="button" className="button button-outline" onClick={() => planInput.current?.click()}>Tải lên</button>
              <button type="button" className="button button-outline activity-danger" disabled={!plan && (!draft.planUrl || removePlan)} onClick={() => {
                if (plan) { setPlan(null); if (planInput.current) planInput.current.value = ''; }
                else { setRemoveFile('plan'); removeDialog.current?.showModal(); }
              }}>Gỡ tệp</button>
            </div>
            {draft.planUrl && !removePlan && <a className="text-button" href={draft.planUrl} download>Tải tệp đã lưu</a>}
          </div>
        </div>
        <div hidden={tab !== 'schedule'} className="editor-grid">
          <div className="field"><label htmlFor="activity-start">Bắt đầu</label><input id="activity-start" type="datetime-local" value={localTime(draft.startAt)} onChange={(event) => change('startAt', utcTime(event.target.value))} /></div>
          <div className="field"><label htmlFor="activity-end">Kết thúc</label><input id="activity-end" type="datetime-local" value={localTime(draft.endAt)} onChange={(event) => change('endAt', utcTime(event.target.value))} /></div>
          <div className="field full-width"><label htmlFor="activity-location">Địa điểm</label><input id="activity-location" maxLength={2000} value={draft.location ?? ''} onChange={(event) => { const location = event.target.value; setDraft((current) => current ? { ...current, location, latitude: null, longitude: null } : current); setLocationSearch(location); setDirty(true); setMessage('Địa điểm đã thay đổi. Ghim lại vị trí trước khi lưu tọa độ.'); }} /><p className="field-hint">Nhập địa chỉ kèm tỉnh/thành để bản đồ tự tìm vị trí.</p></div>
          <div className="field full-width"><label htmlFor="activity-location-note">Ghi chú địa điểm</label><textarea id="activity-location-note" rows={3} maxLength={4000} value={draft.locationNote ?? ''} placeholder="Ví dụ: cổng vào, tầng hoặc hướng dẫn tìm địa điểm" onChange={(event) => change('locationNote', event.target.value)} /></div>
          {tab === 'schedule' && <LocationPicker latitude={draft.latitude} longitude={draft.longitude} searchQuery={locationSearch} disabled={disabled} onSelect={(location) => { setDraft((current) => current ? { ...current, location, latitude: null, longitude: null } : current); setDirty(true); setMessage('Địa điểm đã thay đổi. Ghim lại vị trí trước khi lưu tọa độ.'); }} onChange={(point) => { setDraft((current) => current ? { ...current, latitude: point?.lat ?? null, longitude: point?.lng ?? null } : current); setLocationSearch(''); setDirty(true); setMessage(''); }} />}
        </div>
        <div hidden={tab !== 'assignments'} className="assignment-editor">
          <p className="field-hint">Phân công của bản nháp chỉ hiển thị trên thiết bị đã lưu.</p>
          <div className="field"><label htmlFor="assignee-search">Tìm người phụ trách</label><input id="assignee-search" type="search" maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          {lookupPending && <p role="status">Đang tải người phụ trách…</p>}
          {!lookupPending && lookupError && <p id="assignee-lookup-error" role="alert">{lookupError}</p>}
          {!lookupPending && !lookupError && accounts.length === 0 && <p role="status">Không tìm thấy người phụ trách phù hợp.</p>}
          {assignments.map((row, index) => <section className="assignment-row" key={row.key}><div className="assignment-row-heading"><h2>Nhiệm vụ {index + 1}</h2><button className="text-button activity-danger" type="button" onClick={() => { setAssignments((current) => current.filter((item) => item.key !== row.key)); setAssignmentDirty(true); }}>Xóa nhiệm vụ</button></div><div className="editor-grid">
            <div className="field"><label htmlFor={`task-type-${row.key}`}>Loại nhiệm vụ</label><SelectField id={`task-type-${row.key}`} value={row.type} onChange={(event) => {
              if (event.target.value === 'leader' && assignments.some((item) => item.key !== row.key && item.type === 'leader')) {
                toast('error', 'Hoạt động đã có nhiệm vụ Trưởng BTC.');
                return;
              }
              const type = event.target.value === 'leader' ? 'leader' : 'member';
              setAssignments((current) => current.map((item) => item.key === row.key ? {
                ...item, type, ...(type === 'leader' && !leaders.some((person) => String(person.id_nguoi_dung) === item.userId) && { userId: '', assigneeName: undefined }),
              } : item));
              setAssignmentDirty(true);
            }}><option value="member">Thành viên</option><option value="leader" disabled={assignments.some((item) => item.key !== row.key && item.type === 'leader')}>Trưởng BTC</option></SelectField></div>
            <div className="field"><label htmlFor={`task-name-${row.key}`}>Tên nhiệm vụ</label><input id={`task-name-${row.key}`} maxLength={255} value={row.name} onChange={(event) => changeAssignment(index, 'name', event.target.value)} /></div>
            <div className="field"><label htmlFor={`task-user-${row.key}`}>Người phụ trách</label><SelectField id={`task-user-${row.key}`} value={row.userId} aria-busy={lookupPending} aria-describedby={!lookupPending && lookupError ? 'assignee-lookup-error' : undefined} onChange={(event) => {
              const userId = event.target.value;
              setAssignments((current) => current.map((item) => item.key === row.key ? { ...item, userId, assigneeName: (row.type === 'leader' ? leaders : accounts).find((account) => String(account.id_nguoi_dung) === userId)?.ho_ten } : item));
              setAssignmentDirty(true);
            }}><option value="">Chọn người phụ trách</option>{row.type !== 'leader' && row.userId && !accounts.some((account) => String(account.id_nguoi_dung) === row.userId) && <option value={row.userId}>{row.assigneeName ?? `Tài khoản #${row.userId}`}</option>}{(row.type === 'leader' ? leaders : accounts).map((account) => <option value={account.id_nguoi_dung} key={account.id_nguoi_dung}>{account.ten_dang_nhap} — {account.ho_ten}</option>)}</SelectField></div>
            <div className="field"><label htmlFor={`task-description-${row.key}`}>Mô tả nhiệm vụ</label><input id={`task-description-${row.key}`} value={row.description} onChange={(event) => changeAssignment(index, 'description', event.target.value)} /></div>
          </div></section>)}
          <div className="activity-card-actions"><button className="button button-outline" type="button" onClick={() => { setAssignments((current) => [...current, { key: crypto.randomUUID(), userId: '', name: '', description: '', type: 'member' }]); setAssignmentDirty(true); }}>Thêm nhiệm vụ</button></div>
        </div>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    </form>
  </div>;
}
