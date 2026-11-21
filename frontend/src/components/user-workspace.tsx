'use client';

import { ChangePasswordForm } from './change-password-form';
import { PersonalProfile } from './personal-profile';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './icon';
import { ServiceNotice } from './service-notice';
import { ActivityBackLink } from './activity-back-link';
import { AdminAccounts } from './admin-accounts';
import { SelectField } from './select-field';
import { ActivityMedia } from './activity-media';
import { readAssignments } from '@/lib/activity-draft';
import { useToast } from './toast';
import { activityStatusLabel, workspaceViews, type SystemActivity, type WorkspaceView, type WorkspaceData } from '@/lib/workspace';

const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(value)) : 'Chưa có thông tin';

const statusLabels: Record<string, string> = {
  registered: 'Đã đăng ký', completed: 'Hoàn thành', missed: 'Không hoàn thành',
  assigned: 'Đã phân công', in_progress: 'Đang thực hiện', pending_review: 'Chờ xác nhận',
  scheduled: 'Đã lên lịch', open: 'Đang mở', closed: 'Đã đóng',
  pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối',
};

function ActivityRemoval({ activity, actorId, cancel = false }: { activity: SystemActivity; actorId: number; cancel?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const action = cancel ? 'Hủy hoạt động' : 'Xóa bản nháp';

  async function remove(reason: string) {
    if (pending) return;
    setPending(true);
    try {
      if (!cancel && readAssignments(actorId, activity.id).length > 0) {
        toast('error', 'Bản nháp còn nhiệm vụ đã lưu trên thiết bị này nên không thể xóa.');
        return;
      }
      const response = await fetch(`/api/backend/activities/${activity.id}${cancel ? '/cancel' : ''}`, {
        method: cancel ? 'POST' : 'DELETE', headers: { 'Content-Type': 'application/json' },
        ...(cancel && { body: JSON.stringify({ reason }) }),
      });
      if (!response.ok) {
        const body = await response.json() as { message?: string };
        toast('error', body.message ?? (cancel ? 'Không thể hủy hoạt động.' : 'Không thể xóa bản nháp.'));
        return;
      }
      dialog.current?.close();
      toast('success', cancel ? 'Đã hủy hoạt động.' : 'Đã xóa bản nháp.');
      if (!cancel) router.replace('/system?view=activities');
      router.refresh();
    } catch {
      toast('error', 'Không thể xác nhận kết quả. Vui lòng tải lại trang để kiểm tra.');
    } finally {
      setPending(false);
    }
  }

  return <>
    <button type="button" className="button button-outline activity-danger" onClick={() => dialog.current?.showModal()}>{action}</button>
    <dialog ref={dialog} className="surface face-guide" aria-labelledby="delete-draft-title" aria-describedby="delete-draft-description"
      onCancel={(event) => { if (pending) event.preventDefault(); }}>
      <h2 id="delete-draft-title">{cancel ? 'Xác nhận hủy hoạt động' : 'Xác nhận xóa bản nháp'}</h2>
      <p id="delete-draft-description">{cancel ? 'Hoạt động sẽ ngừng tiếp nhận đăng ký.' : 'Bản nháp sẽ bị xóa.'} Bạn muốn tiếp tục với “{activity.name}”?</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
        if (cancel && !reason) { toast('error', 'Nhập lý do hủy hoạt động.'); return; }
        void remove(reason);
      }}>
      {cancel && <label className="field">Lý do hủy<textarea name="reason" maxLength={1000} required disabled={pending} /></label>}
      <div className="face-guide-actions">
        <button type="button" className="button button-outline" disabled={pending} onClick={() => dialog.current?.close()}>{cancel ? 'Giữ hoạt động' : 'Giữ bản nháp'}</button>
        <button type="submit" className="button button-outline activity-danger" disabled={pending}>{pending ? 'Đang xử lý…' : action}</button>
      </div>
      </form>
    </dialog>
  </>;
}

function PublishedActivityEdit({ id }: { id: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [fields, setFields] = useState<{ name: string; description: string | null; locationNote?: string | null; revision: string }>();
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const toast = useToast();
  async function open() {
    setPending(true);
    try {
      const response = await fetch(`/api/backend/activities/${id}/editor`, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      setFields(await response.json());
      dialog.current?.showModal();
    } catch { toast('error', 'Không thể tải thông tin hoạt động.'); }
    finally { setPending(false); }
  }
  return <>
    <button type="button" className="button button-primary" disabled={pending} onClick={() => void open()}>Chỉnh sửa hoạt động</button>
    <dialog ref={dialog} className="surface face-guide" aria-labelledby="published-edit-title" onCancel={(event) => { if (pending) event.preventDefault(); }}>
      <h2 id="published-edit-title">Chỉnh sửa hoạt động</h2>
      {fields && <form key={fields.revision} onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const values = new FormData(event.currentTarget);
        setPending(true);
        try {
          const response = await fetch(`/api/backend/activities/${id}/published-details`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: values.get('name'), description: values.get('description'), locationNote: values.get('locationNote'), revision: fields.revision }),
          });
          if (!response.ok) {
            const { message } = await response.json() as { message?: string };
            toast('error', message ?? 'Không thể cập nhật hoạt động.');
            return;
          }
          dialog.current?.close();
          toast('success', 'Đã cập nhật hoạt động.');
          router.refresh();
        } catch { toast('error', 'Không thể xác nhận kết quả cập nhật. Vui lòng tải lại trang.'); }
        finally { setPending(false); }
      }}>
        <label className="field">Tên hoạt động<input name="name" defaultValue={fields.name} required maxLength={255} disabled={pending} /></label>
        <label className="field">Mô tả<textarea name="description" defaultValue={fields.description ?? ''} maxLength={10000} disabled={pending} /></label>
        <label className="field">Ghi chú địa điểm<textarea name="locationNote" defaultValue={fields.locationNote ?? ''} maxLength={4000} disabled={pending} /></label>
        <p className="field-hint">Nếu đổi tên, người đã đăng ký sẽ nhận thông báo.</p>
        <div className="face-guide-actions">
          <button type="button" className="button button-outline" disabled={pending} onClick={() => dialog.current?.close()}>Đóng</button>
          <button type="submit" className="button button-primary" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
        </div>
      </form>}
    </dialog>
  </>;
}

function ActivityAssignments({ activity, actorId, editable, canComplete }: { activity: SystemActivity; actorId: number; editable: boolean; canComplete: boolean }) {
  const [local, setLocal] = useState<NonNullable<SystemActivity['assignments']>>([]);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState<number>();
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    if (!editable) return;
    async function load() {
      try {
        const rows = readAssignments(actorId, activity.id);
        setLocal(rows.map((row, index) => ({
          id: index, name: row.name || 'Chưa đặt tên nhiệm vụ', type: row.type,
          assignee: row.assigneeName || (row.userId ? `Tài khoản #${row.userId}` : 'Chưa phân công'),
        })));
        setFailed(false);
      } catch { setFailed(true); }
    }
    void load();
  }, [actorId, activity.id, editable]);
  const rows = [...(activity.assignments ?? []), ...local];
  async function complete(id: number) {
    if (saving !== undefined) return;
    setSaving(id);
    try {
      const response = await fetch(`/api/backend/activities/${activity.id}/tasks/${id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error();
      toast('success', 'Đã đánh dấu nhiệm vụ hoàn thành.');
      router.refresh();
    } catch { toast('error', 'Không thể cập nhật nhiệm vụ. Vui lòng thử lại.'); }
    finally { setSaving(undefined); }
  }
  return <section className="surface activity-detail">
    <h2>Phân công</h2>
    {failed && <p role="alert">Không thể đọc phân công đã lưu trên thiết bị này.</p>}
    {rows.length > 0 ? <div className="activity-task-table" tabIndex={0} role="region" aria-label="Danh sách phân công">
      <table><thead><tr><th scope="col">Loại nhiệm vụ</th><th scope="col">Tên nhiệm vụ</th><th scope="col">Người phụ trách</th><th scope="col">Trạng thái</th></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>
        <td>{row.type === 'leader' ? 'Trưởng BTC' : 'Thành viên'}</td><td>{row.name}</td><td>{row.assignee}</td>
        <td><span>{row.status === 'completed' ? 'Hoàn thành' : 'Chưa hoàn thành'}</span>
          {canComplete && row.status && row.status !== 'completed' && <button type="button" className="text-button" disabled={saving !== undefined} onClick={() => void complete(row.id)}>{saving === row.id ? 'Đang lưu…' : 'Đánh dấu hoàn thành'}</button>}
        </td>
      </tr>)}</tbody></table>
    </div> : !failed && <p>Chưa có nhiệm vụ hiển thị.</p>}
  </section>;
}

function EvidenceRecords({ items }: { items: WorkspaceData['evidence'] }) {
  const [status, setStatus] = useState('pending');
  const visible = items.filter((item) => item.status === status);
  return <section className="surface evidence-records">
    <div className="evidence-tabs" role="group" aria-label="Trạng thái minh chứng">
      {['pending', 'approved', 'rejected'].map((value) => <button className="button button-outline" key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{statusLabels[value]}</button>)}
    </div>
    {visible.length ? visible.map((item) => <article key={item.id}><h2>{item.name}</h2><p>{item.organization}</p><p>{item.date?.split('-').reverse().join('/')}</p><p>{statusLabels[item.status]}</p>{item.reason && <p>{item.reason}</p>}<button className="button button-outline" disabled>Xem tệp minh chứng</button></article>) : <div className="workspace-empty"><h2>Chưa có minh chứng</h2></div>}
  </section>;
}

export function UserWorkspace({ data, view, activityId }: {
  data: WorkspaceData; view: WorkspaceView; activityId: number | null;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [staffGroup, setStaffGroup] = useState('draft');
  const [activityFilter, setActivityFilter] = useState('all');
  const staffListRef = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [view, activityId, data.user.type]);
  const student = data.user.role === 'user' && data.user.type === 'student';
  const tasks = data.activities.flatMap((activity) => activity.tasks.map((task) => ({ ...task, activity: activity.name })));
  const registrations = data.activities.filter((activity) => activity.registrationStatus).sort((a, b) => Date.parse(b.startAt ?? '') - Date.parse(a.startAt ?? ''));
  const earnedPoints = registrations.reduce((total, activity) => total + activity.awardedPoints, 0) + data.evidence.reduce((total, item) => total + item.points, 0);
  const href = (next: WorkspaceView, activity?: number) => `/system?view=${next}${activity ? `&activity=${activity}` : ''}`;
  const selected = (view === 'activities' || view === 'published') ? data.activities.find((activity) => activity.id === activityId) : undefined;
  const canEdit = data.user.role === 'staff' && selected?.ownerId === data.user.id && selected.status === 'draft';
  const day = 86400000;
  const offset = 7 * 3600000;
  const canCancel = data.user.role === 'staff' && selected?.ownerId === data.user.id && selected.status === 'published' &&
    !!selected.startAt && Date.parse(data.serverTime) < (Math.floor((Date.parse(selected.startAt) + offset) / day) - 1) * day - offset;
  const activityViews: WorkspaceView[] = data.user.role === 'staff' ? ['activities', 'published', 'evidenceReview'] : data.user.role === 'user' ? ['activities', 'registrations', 'evidence'] : [];
  const upcoming = (activity: SystemActivity) => ['published', 'pending'].includes(activity.status) && !!activity.startAt && Date.parse(activity.startAt) > Date.parse(data.serverTime);
  const source = view === 'published' ? data.activities.filter((activity) => activity.status !== 'draft') : data.user.role === 'staff' ? data.activities.filter((activity) => staffGroup === 'draft' ? activity.status === 'draft' && activity.ownerId === data.user.id : upcoming(activity)) : data.activities;
  const showStatusFilter = data.user.role === 'staff' && (view === 'published' || staffGroup === 'upcoming');
  const staffList = data.user.role === 'staff';
  const showSearch = !staffList || showStatusFilter;
  const visible = source.filter((activity) =>
    (!showSearch || activity.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) &&
    (!showStatusFilter || activityFilter === 'all' || activity.status === activityFilter) &&
    (filter === 'all' || (filter === 'registered' ? !!activity.registrationStatus : !activity.registrationStatus)));
  const pageItems = visible.slice(staffList ? 0 : (page - 1) * 10, page * 10);
  useEffect(() => {
    const list = staffListRef.current;
    if (!list) return;
    const items = Array.from(list.children).slice(0, 4);
    const resize = () => {
      const count = window.matchMedia('(min-width: 1100px)').matches ? 4 : 2;
      const top = list.getBoundingClientRect().top;
      const bottom = Math.max(...items.slice(0, count).map((item) => item.getBoundingClientRect().bottom - top + list.scrollTop));
      if (Number.isFinite(bottom)) list.style.setProperty('--activity-list-height', `${Math.ceil(bottom)}px`);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(list);
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [activityFilter, pageItems.length, search, selected, staffGroup, view]);
  function resetListPage() {
    setPage(1);
    if (staffListRef.current) staffListRef.current.scrollTop = 0;
  }
  const locked = 'Chức năng chưa khả dụng.';

  function activityCard(activity: SystemActivity) {
    const viewLink = <Link prefetch={false} className="button button-outline" href={href(view, activity.id)} aria-label={`Xem ${activity.name}`}>Xem</Link>;
    return <article className="surface activity-card" key={activity.id}>
      <ActivityMedia src={activity.imageUrl} />
      <div className="activity-card-top">{(!staffList || activity.status !== 'draft') && <span className="status-label">{activityStatusLabel(activity.status)}</span>}{activity.registrationStatus && <span className="status-label">{statusLabels[activity.registrationStatus] ?? 'Chưa xác định'}</span>}{staffList && viewLink}</div>
      <h2>{activity.name}</h2>
      <dl className="activity-facts"><div><dt>Thời gian</dt><dd>{dateTime(activity.startAt)}</dd></div><div><dt>Địa điểm</dt><dd>{activity.location}</dd></div><div><dt>Số chỗ còn lại</dt><dd>{activity.capacity === null ? 'Không giới hạn' : Math.max(0, activity.capacity - activity.registrations)}</dd></div><div><dt>Điểm hoạt động</dt><dd>{activity.points}</dd></div></dl>
      {!staffList && <div className="activity-card-actions">{student && <button className="button button-primary" disabled title={locked}>{activity.registrationStatus ? 'Hủy đăng ký' : 'Đăng ký'}</button>}{viewLink}</div>}
    </article>;
  }

  return <div className="container system-workspace">
        {data.user.role !== 'admin' && (view !== 'activities' || selected) && <ActivityBackLink published={data.user.role === 'staff' && !!selected && selected.status !== 'draft'} />}
        <div className={selected ? 'workspace-heading activity-detail-heading' : 'workspace-heading'}><div><h1 ref={heading} tabIndex={-1}>{selected ? 'Chi tiết hoạt động' : activityViews.includes(view) ? workspaceViews.activities : workspaceViews[view]}</h1></div>
          {selected && (canEdit || canCancel) && <div className="activity-card-actions">
            {canEdit && <Link prefetch={false} className="button button-primary" href={`/system?view=activities&editor=${selected.id}`}>Chỉnh sửa hoạt động</Link>}
            {canEdit && <ActivityRemoval activity={selected} actorId={data.user.id} />}
            {canCancel && <PublishedActivityEdit id={selected.id} />}
            {canCancel && <ActivityRemoval activity={selected} actorId={data.user.id} cancel />}
          </div>}
        </div>

        {!selected && activityViews.includes(view) && <nav className="workspace-tabs" aria-label="Các mục hoạt động">{activityViews.map((tab) => <Link key={tab} href={href(tab)} prefetch={false} aria-current={view === tab ? 'page' : undefined}>{workspaceViews[tab]}</Link>)}</nav>}
        {data.user.role === 'staff' && view === 'activities' && !selected && <div className="staff-activity-toolbar"><div className="evidence-tabs" role="group" aria-label="Nhóm hoạt động"><button type="button" className="button button-outline" aria-pressed={staffGroup === 'draft'} onClick={() => { setStaffGroup('draft'); resetListPage(); }}>{activityStatusLabel('draft')}</button><button type="button" className="button button-outline" aria-pressed={staffGroup === 'upcoming'} onClick={() => { setStaffGroup('upcoming'); resetListPage(); }}>Sắp diễn ra</button></div><Link className="button button-primary" href="/system?view=activities&editor=new" prefetch={false}>Tạo hoạt động</Link></div>}

        {view === 'evidenceReview' && <section className="surface workspace-empty"><Icon name="document" /><h2>Duyệt minh chứng</h2><p>Chức năng duyệt minh chứng chưa khả dụng.</p><div className="activity-card-actions"><button className="button button-primary" disabled>Duyệt</button><button className="button button-outline" disabled>Từ chối</button></div></section>}
        {view === 'published' && !selected && <p className="workspace-description">Các hoạt động đã được công bố.</p>}
        {view === 'accounts' && <AdminAccounts />}

        {(view === 'activities' || view === 'published') && !selected && <>
          {showSearch && <form className={staffList ? 'workspace-toolbar staff-activity-filters' : 'workspace-toolbar'} onSubmit={(event) => event.preventDefault()}><div className="field"><label htmlFor="activity-search">{staffList ? 'Tìm kiếm' : 'Tìm theo tên hoạt động'}</label><input id="activity-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); resetListPage(); }} placeholder="Nhập tên hoạt động" /></div>{student && <div className="field"><label htmlFor="registration-filter">Trạng thái đăng ký</label><SelectField id="registration-filter" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="all">Tất cả</option><option value="registered">Đã đăng ký</option><option value="available">Chưa đăng ký</option></SelectField></div>}
          {showStatusFilter && <label className="field">Trạng thái hoạt động<SelectField value={activityFilter} onChange={(event) => { setActivityFilter(event.target.value); resetListPage(); }}>
            <option value="all">Tất cả</option>{[...new Set(source.map((activity) => activity.status))].map((status) => <option key={status} value={status}>{activityStatusLabel(status)}</option>)}
          </SelectField></label>}</form>}
          {data.user.role !== 'staff' && <p className="result-count">{visible.length} hoạt động</p>}
          {visible.length ? <div className={staffList ? 'activity-list staff-activity-list' : 'activity-list'}
            ref={staffList ? staffListRef : undefined} tabIndex={staffList ? 0 : undefined} role={staffList ? 'region' : undefined}
            aria-label={staffList ? 'Danh sách thẻ hoạt động' : undefined}
            onScroll={staffList ? (event) => {
              const list = event.currentTarget;
              if (pageItems.length < visible.length && list.scrollHeight - list.scrollTop - list.clientHeight < 80) {
                setPage((current) => Math.max(current, page + 1));
              }
            } : undefined}>{pageItems.map(activityCard)}</div> : <div className="surface workspace-empty"><Icon name="calendar" /><h2>Chưa có hoạt động phù hợp</h2>{showSearch && <p>Thử thay đổi từ khóa hoặc bộ lọc.</p>}</div>}
          {!staffList && visible.length > 10 && <div className="workspace-pagination"><button className="button button-outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span><button className="button button-outline" disabled={page * 10 >= visible.length} onClick={() => setPage(page + 1)}>Trang sau</button></div>}
        </>}

        {selected && <div className={data.user.role === 'staff' ? 'activity-detail-grid' : 'activity-list'}>
          <section className="surface activity-detail">
            <h2>Thông tin chung</h2><ActivityMedia src={selected.imageUrl} preview /><h3>{selected.name}</h3>{selected.description && <p>{selected.description}</p>}
            <dl className="activity-facts"><div><dt>Bắt đầu</dt><dd>{dateTime(selected.startAt)}</dd></div><div><dt>Kết thúc</dt><dd>{dateTime(selected.endAt)}</dd></div><div><dt>Địa điểm</dt><dd>{selected.location || 'Chưa có thông tin'}</dd></div><div><dt>Điểm hoạt động</dt><dd>{selected.points}</dd></div><div><dt>Điểm danh khi kết thúc</dt><dd>{selected.requiresCheckout ? 'Bắt buộc' : 'Không bắt buộc'}</dd></div></dl>
            {selected.locationNote && <dl className="activity-facts"><div><dt>Ghi chú địa điểm</dt><dd>{selected.locationNote}</dd></div></dl>}
            {student && <div className="activity-card-actions"><button className="button button-primary" disabled title={locked}>{selected.registrationStatus ? 'Hủy đăng ký' : 'Đăng ký'}</button></div>}
            {selected.status !== 'draft' && <p><span className="status-label">{activityStatusLabel(selected.status)}</span></p>}
          </section>
          <ActivityAssignments activity={selected} actorId={data.user.id} editable={canEdit} canComplete={data.user.role === 'staff' && selected.ownerId === data.user.id && !['draft', 'cancelled', 'issues'].includes(selected.status)} />
        </div>}

        {view === 'attendance' && <><p className="workspace-description">Phiên điểm danh của các hoạt động bạn đã đăng ký.</p>{registrations.flatMap((activity) => activity.sessions.map((session, index) => <section className="surface attendance-card" key={`${activity.id}-${index}`}><h2>{activity.name}</h2><p>{session.type === 'check_in' ? 'Check-in' : 'Checkout'} · {statusLabels[session.status] ?? 'Chưa xác định'}</p><p>{dateTime(session.startAt)} — {dateTime(session.endAt)}</p><div className="verification-steps"><span>Quét QR</span><span>Vị trí GPS</span><span>Xác minh FaceIO</span><span>Xác nhận</span></div><ServiceNotice title={locked}>{locked}</ServiceNotice><button className="button button-primary" disabled>Bắt đầu điểm danh</button></section>))}{!registrations.some((activity) => activity.sessions.length) && <div className="surface workspace-empty"><h2>Chưa có phiên điểm danh</h2></div>}</>}

        {(view === 'statistics' || view === 'registrations') && <>
          <div className="workspace-statistics"><div className="surface"><span>Hoạt động đã đăng ký</span><strong>{registrations.length}</strong></div><div className="surface"><span>Điểm đã ghi nhận</span><strong>{earnedPoints}</strong></div></div>
          <div className="surface workspace-table"><table><caption>Kết quả tham gia</caption><thead><tr><th>Hoạt động</th><th>Ngày tham gia</th><th>Trạng thái</th><th>Điểm</th></tr></thead><tbody>{registrations.length ? registrations.slice((page - 1) * 10, page * 10).map((activity) => <tr key={activity.id}><td>{activity.name}</td><td>{dateTime(activity.startAt)}</td><td>{statusLabels[activity.registrationStatus ?? ''] ?? 'Chưa xác định'}</td><td>{activity.awardedPoints}</td></tr>) : <tr><td colSpan={4}>Chưa có kết quả tham gia.</td></tr>}</tbody></table></div>
          {registrations.length > 10 && <div className="workspace-pagination"><button className="button button-outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span><button className="button button-outline" disabled={page * 10 >= registrations.length} onClick={() => setPage(page + 1)}>Trang sau</button></div>}
        </>}

        {view === 'evidence' && <div className="evidence-layout"><section className="surface evidence-form"><h2>Nộp minh chứng</h2><p className="field-hint">Hoạt động cộng đồng ngoài hệ thống.</p><fieldset disabled><div className="field"><label htmlFor="evidence-name">Tên hoạt động</label><input id="evidence-name" /></div><div className="field"><label htmlFor="evidence-organization">Đơn vị tổ chức</label><input id="evidence-organization" /></div><div className="field"><label htmlFor="evidence-date">Ngày tham gia</label><input id="evidence-date" type="date" /></div><div className="field"><label htmlFor="evidence-description">Mô tả hoạt động</label><textarea id="evidence-description" rows={3} /></div><div className="field"><label htmlFor="evidence-file">Tệp minh chứng</label><input id="evidence-file" type="file" accept=".jpg,.jpeg,.png,.pdf" /><p className="field-hint">JPG, JPEG, PNG hoặc PDF · Tối đa 10 MB</p></div></fieldset><button className="button button-primary" disabled>Nộp minh chứng</button></section><EvidenceRecords items={data.evidence} /></div>}

        {view === 'tasks' && <>{tasks.length ? tasks.map((task) => <article className="surface task-card" key={task.id}><span className="status-label">{statusLabels[task.status] ?? 'Chưa xác định'}</span><h2>{task.name}</h2><p>{task.activity}</p><div className="activity-card-actions"><button className="button button-primary" disabled>Bắt đầu</button><button className="button button-outline" disabled>Báo hoàn thành</button></div></article>) : <div className="surface workspace-empty"><h2>Chưa có nhiệm vụ được giao</h2></div>}</>}

        {view === 'profile' && <div className="profile-layout">
          <PersonalProfile user={data.user} />
          <section className="surface profile-card"><h2>Bảo mật tài khoản</h2><ChangePasswordForm /></section>
        </div>}
  </div>;
}
