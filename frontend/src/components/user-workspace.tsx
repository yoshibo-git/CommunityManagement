'use client';

import { ChangePasswordForm } from './change-password-form';
import { PersonalProfile } from './personal-profile';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icon';
import { ServiceNotice } from './service-notice';
import { ActivityBackLink } from './activity-back-link';
import { workspaceViews, type SystemActivity, type WorkspaceView, type WorkspaceData } from '@/lib/workspace';

const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(value)) : 'Chưa có thông tin';

const statusLabels: Record<string, string> = {
  draft: 'Bản nháp', published: 'Đã công bố', progress: 'Đang diễn ra', pending_completed: 'Chờ hoàn tất', pending_issues: 'Đang có sự cố', issues: 'Kết thúc do sự cố', cancelled: 'Đã hủy',
  registered: 'Đã đăng ký', completed: 'Hoàn thành', missed: 'Không hoàn thành',
  assigned: 'Đã phân công', in_progress: 'Đang thực hiện', pending_review: 'Chờ xác nhận',
  scheduled: 'Đã lên lịch', open: 'Đang mở', closed: 'Đã đóng',
  pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối',
};

const roleLabels: Record<string, string> = { user: 'Người dùng', staff: 'Quản lý', admin: 'Admin' };

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
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [view, activityId, data.user.type]);
  const student = data.user.role === 'user' && data.user.type === 'student';
  const tasks = data.activities.flatMap((activity) => activity.tasks.map((task) => ({ ...task, activity: activity.name })));
  const registrations = data.activities.filter((activity) => activity.registrationStatus).sort((a, b) => Date.parse(b.startAt ?? '') - Date.parse(a.startAt ?? ''));
  const earnedPoints = registrations.reduce((total, activity) => total + activity.awardedPoints, 0) + data.evidence.reduce((total, item) => total + item.points, 0);
  const href = (next: WorkspaceView, activity?: number) => `/system?view=${next}${activity ? `&activity=${activity}` : ''}`;
  const selected = data.activities.find((activity) => activity.id === activityId);
  const activityViews: WorkspaceView[] = data.user.role === 'staff' ? ['activities', 'published', 'evidenceReview'] : data.user.role === 'user' ? ['activities', 'registrations', 'evidence'] : [];
  const upcoming = (activity: SystemActivity) => ['published', 'pending'].includes(activity.status) && !!activity.startAt && Date.parse(activity.startAt) > Date.parse(data.serverTime);
  const source = view === 'published' ? data.activities.filter((activity) => activity.status !== 'draft') : data.user.role === 'staff' ? data.activities.filter((activity) => staffGroup === 'draft' ? activity.status === 'draft' && activity.ownerId === data.user.id : upcoming(activity)) : data.activities;
  const visible = source.filter((activity) =>
    activity.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')) &&
    (filter === 'all' || (filter === 'registered' ? !!activity.registrationStatus : !activity.registrationStatus)));
  const pageItems = visible.slice((page - 1) * 10, page * 10);
  const locked = 'Chức năng chưa khả dụng.';

  function activityCard(activity: SystemActivity) {
    return <article className="surface activity-card" key={activity.id}>
      <span className="status-label">{activity.status === 'pending' ? 'Sắp diễn ra · Đã khóa chỉnh sửa' : statusLabels[activity.status] ?? 'Chỉ xem'}</span>
      <div className="activity-card-top">{activity.registrationStatus && <span className="status-label">{statusLabels[activity.registrationStatus] ?? 'Chưa xác định'}</span>}</div>
      <h2>{activity.name}</h2>
      <dl className="activity-facts"><div><dt>Thời gian</dt><dd>{dateTime(activity.startAt)}</dd></div><div><dt>Địa điểm</dt><dd>{activity.location}</dd></div><div><dt>Số chỗ còn lại</dt><dd>{activity.capacity === null ? 'Không giới hạn' : Math.max(0, activity.capacity - activity.registrations)}</dd></div><div><dt>Điểm hoạt động</dt><dd>{activity.points}</dd></div></dl>
      <div className="activity-card-actions"><Link prefetch={false} className="button button-outline" href={href('activities', activity.id)}>Xem chi tiết</Link>{data.user.role === 'staff' && activity.ownerId === data.user.id && activity.status === 'draft' && <Link prefetch={false} className="button button-primary" href={`/system?view=activities&editor=${activity.id}`}>Chỉnh sửa hoạt động</Link>}{student && <button className="button button-primary" disabled title={locked}>{activity.registrationStatus ? 'Hủy đăng ký' : 'Đăng ký'}</button>}</div>
    </article>;
  }

  return <div className="container system-workspace">
        {data.user.role !== 'admin' && (view !== 'activities' || selected) && <ActivityBackLink />}
        <div className="workspace-heading"><div><h1 ref={heading} tabIndex={-1}>{selected && view === 'activities' ? 'Chi tiết hoạt động' : activityViews.includes(view) ? workspaceViews.activities : workspaceViews[view]}</h1></div></div>

        {activityViews.includes(view) && <nav className="workspace-tabs" aria-label="Các mục hoạt động">{activityViews.map((tab) => <Link key={tab} href={href(tab)} prefetch={false} aria-current={view === tab ? 'page' : undefined}>{workspaceViews[tab]}</Link>)}</nav>}
        {data.user.role === 'staff' && view === 'activities' && !selected && <div className="staff-activity-toolbar"><div className="evidence-tabs" role="group" aria-label="Nhóm hoạt động"><button type="button" className="button button-outline" aria-pressed={staffGroup === 'draft'} onClick={() => { setStaffGroup('draft'); setPage(1); }}>Bản nháp</button><button type="button" className="button button-outline" aria-pressed={staffGroup === 'upcoming'} onClick={() => { setStaffGroup('upcoming'); setPage(1); }}>Sắp diễn ra</button></div><Link className="button button-primary" href="/system?view=activities&editor=new" prefetch={false}>Tạo hoạt động</Link></div>}

        {view === 'evidenceReview' && <section className="surface workspace-empty"><Icon name="document" /><h2>Duyệt minh chứng</h2><p>Chức năng duyệt minh chứng chưa khả dụng.</p><div className="activity-card-actions"><button className="button button-primary" disabled>Duyệt</button><button className="button button-outline" disabled>Từ chối</button></div></section>}
        {view === 'published' && <p className="workspace-description">Các hoạt động đã được công bố.</p>}
        {view === 'accounts' && <div className="surface workspace-table"><table><caption>Tài khoản hệ thống</caption><thead><tr><th>Tài khoản</th><th>Họ và tên</th><th>Vai trò</th><th>Trạng thái</th></tr></thead><tbody>{data.accounts.map((account) => <tr key={account.id_nguoi_dung}><td>{account.ten_dang_nhap}</td><td>{account.ho_ten}</td><td>{roleLabels[account.vai_tro.ten_vai_tro]}</td><td>{account.trang_thai === 'active' ? 'Đang hoạt động' : 'Không hoạt động'}</td></tr>)}</tbody></table></div>}

        {(view === 'activities' || view === 'published') && !selected && <>
          <form className="workspace-toolbar" onSubmit={(event) => event.preventDefault()}><div className="field"><label htmlFor="activity-search">Tìm theo tên hoạt động</label><input id="activity-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nhập tên hoạt động" /></div>{student && <div className="field"><label htmlFor="registration-filter">Trạng thái đăng ký</label><select id="registration-filter" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="all">Tất cả</option><option value="registered">Đã đăng ký</option><option value="available">Chưa đăng ký</option></select></div>}</form>
          <p className="result-count">{visible.length} hoạt động · Tối đa 10 mục mỗi trang</p>
          {visible.length ? <div className="workspace-card-grid">{pageItems.map(activityCard)}</div> : <div className="surface workspace-empty"><Icon name="calendar" /><h2>Chưa có hoạt động phù hợp</h2><p>Thử thay đổi từ khóa hoặc bộ lọc.</p></div>}
          {visible.length > 10 && <div className="workspace-pagination"><button className="button button-outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span><button className="button button-outline" disabled={page * 10 >= visible.length} onClick={() => setPage(page + 1)}>Trang sau</button></div>}
        </>}

        {view === 'activities' && selected && <div className="surface activity-detail"><h2>{selected.name}</h2><p>{selected.description}</p><dl className="activity-facts"><div><dt>Bắt đầu</dt><dd>{dateTime(selected.startAt)}</dd></div><div><dt>Kết thúc</dt><dd>{dateTime(selected.endAt)}</dd></div><div><dt>Địa điểm</dt><dd>{selected.location}</dd></div><div><dt>Điểm hoạt động</dt><dd>{selected.points}</dd></div><div><dt>Checkout</dt><dd>{selected.requiresCheckout ? 'Bắt buộc' : 'Không bắt buộc'}</dd></div></dl>{student && <button className="button button-primary" disabled title={locked}>{selected.registrationStatus ? 'Hủy đăng ký' : 'Đăng ký'}</button>}</div>}

        {view === 'attendance' && <><p className="workspace-description">Phiên điểm danh của các hoạt động bạn đã đăng ký.</p>{registrations.flatMap((activity) => activity.sessions.map((session, index) => <section className="surface attendance-card" key={`${activity.id}-${index}`}><h2>{activity.name}</h2><p>{session.type === 'check_in' ? 'Check-in' : 'Checkout'} · {statusLabels[session.status] ?? 'Chưa xác định'}</p><p>{dateTime(session.startAt)} — {dateTime(session.endAt)}</p><div className="verification-steps"><span>Quét QR</span><span>Vị trí GPS</span><span>Xác minh FaceIO</span><span>Xác nhận</span></div><ServiceNotice title={locked}>{locked}</ServiceNotice><button className="button button-primary" disabled>Bắt đầu điểm danh</button></section>))}{!registrations.some((activity) => activity.sessions.length) && <div className="surface workspace-empty"><h2>Chưa có phiên điểm danh</h2></div>}</>}

        {(view === 'statistics' || view === 'registrations') && <>
          <div className="workspace-statistics"><div className="surface"><span>Hoạt động đã đăng ký</span><strong>{registrations.length}</strong></div><div className="surface"><span>Điểm đã ghi nhận</span><strong>{earnedPoints}</strong></div></div>
          <div className="surface workspace-table"><table><caption>Kết quả tham gia</caption><thead><tr><th>Hoạt động</th><th>Ngày tham gia</th><th>Trạng thái</th><th>Điểm</th></tr></thead><tbody>{registrations.length ? registrations.slice((page - 1) * 10, page * 10).map((activity) => <tr key={activity.id}><td>{activity.name}</td><td>{dateTime(activity.startAt)}</td><td>{statusLabels[activity.registrationStatus ?? ''] ?? 'Chưa xác định'}</td><td>{activity.awardedPoints}</td></tr>) : <tr><td colSpan={4}>Chưa có kết quả tham gia.</td></tr>}</tbody></table></div>
          {registrations.length > 10 && <div className="workspace-pagination"><button className="button button-outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span><button className="button button-outline" disabled={page * 10 >= registrations.length} onClick={() => setPage(page + 1)}>Trang sau</button></div>}
        </>}

        {view === 'evidence' && <div className="evidence-layout"><section className="surface evidence-form"><h2>Nộp minh chứng</h2><p className="field-hint">Hoạt động cộng đồng ngoài hệ thống.</p><fieldset disabled><div className="field"><label htmlFor="evidence-name">Tên hoạt động</label><input id="evidence-name" /></div><div className="field"><label htmlFor="evidence-organization">Đơn vị tổ chức</label><input id="evidence-organization" /></div><div className="field"><label htmlFor="evidence-date">Ngày tham gia</label><input id="evidence-date" type="date" /></div><div className="field"><label htmlFor="evidence-description">Mô tả hoạt động</label><textarea id="evidence-description" rows={3} /></div><div className="field"><label htmlFor="evidence-file">Tệp minh chứng</label><input id="evidence-file" type="file" accept=".jpg,.jpeg,.png,.pdf" /><p className="field-hint">JPG, JPEG, PNG hoặc PDF · Tối đa 10 MB</p></div></fieldset><button className="button button-primary" disabled>Nộp minh chứng</button></section><EvidenceRecords items={data.evidence} /></div>}

        {view === 'tasks' && <>{tasks.length ? tasks.map((task) => <article className="surface task-card" key={task.id}><span className="status-label">{statusLabels[task.status] ?? 'Chưa xác định'}</span><h2>{task.name}</h2><p>{task.activity}</p><p>Thời hạn: {dateTime(task.startAt)} — {dateTime(task.endAt)}</p><div className="activity-card-actions"><button className="button button-primary" disabled>Bắt đầu</button><button className="button button-outline" disabled>Báo hoàn thành</button></div></article>) : <div className="surface workspace-empty"><h2>Chưa có nhiệm vụ được giao</h2></div>}</>}

        {view === 'profile' && <div className="profile-layout">
          <PersonalProfile user={data.user} />
          <section className="surface profile-card"><h2>Bảo mật tài khoản</h2><ChangePasswordForm /></section>
        </div>}
  </div>;
}
