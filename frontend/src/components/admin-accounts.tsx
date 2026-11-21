'use client';

import { useEffect, useRef, useState } from 'react';
import { SelectField } from './select-field';
import { useToast } from './toast';
import { AccountImport } from './account-import';

const roles: Record<string, string> = { user: 'Người dùng', staff: 'Quản lý', admin: 'Quản trị viên' };
const statuses: Record<string, string> = {
  pending_activation: 'Chờ kích hoạt', pending_faceio: 'Chờ đăng ký khuôn mặt', active: 'Đang hoạt động', locked: 'Đã khóa',
};
const types: Record<string, string> = { student: 'Sinh viên', staff: 'Nhân sự' };
type Account = {
  id_nguoi_dung: number;
  ten_dang_nhap: string;
  ho_ten: string;
  email: string;
  so_dien_thoai: string | null;
  trang_thai: string;
  loai_nguoi_dung: string | null;
  id_khoa: string | null;
  khoa: { ten_khoa: string } | null;
  vai_tro: { ten_vai_tro: string };
};
type AccountPage = { items: Account[]; total: number; page: number; pageSize: number };

export function AdminAccounts() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AccountPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [detail, setDetail] = useState<Account | null>(null);
  const [opening, setOpening] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFaculty, setEditFaculty] = useState('');
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const createDialog = useRef<HTMLDialogElement>(null);
  const more = useRef<HTMLDivElement>(null);
  const [faculties, setFaculties] = useState<{ id_khoa: string; ten_khoa: string }[] | null>(null);
  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const params = new URLSearchParams(query);
        params.set('page', String(page));
        const response = await fetch(`/api/backend/users?${params}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Accounts unavailable');
        const data = await response.json() as AccountPage;
        if (!controller.signal.aborted) setResult((previous) =>
          page === 1 || !previous ? data : {
            ...data, items: [...previous.items, ...data.items.filter((account) =>
              !previous.items.some((item) => item.id_nguoi_dung === account.id_nguoi_dung))],
          });
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [page, query, reload]);

  const hasMore = result !== null && page * result.pageSize < result.total;
  useEffect(() => {
    const sentinel = more.current;
    if (!hasMore || loading || failed || !sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setLoading(true);
      setPage(page + 1);
    }, { rootMargin: '120px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, failed, page]);

  async function openAccount(id: number) {
    setOpening(true);
    try {
      const response = await fetch(`/api/backend/users/${id}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Account unavailable');
      setDetail(await response.json() as Account);
      setEditing(false);
      dialog.current?.showModal();
    } catch {
      toast('error', 'Không thể tải thông tin tài khoản. Vui lòng thử lại.');
    } finally {
      setOpening(false);
    }
  }

  function loadPage(next: number, filters = query) {
    setLoading(true);
    setFailed(false);
    setQuery(filters);
    if (next === 1) setResult(null);
    setPage(next);
    setReload((value) => value + 1);
  }

  async function loadFaculties() {
    if (loadingFaculties) return;
    setLoadingFaculties(true);
    try {
      const response = await fetch('/api/backend/users/faculties', { cache: 'no-store' });
      if (!response.ok) throw new Error('Faculties unavailable');
      setFaculties(await response.json() as NonNullable<typeof faculties>);
    } catch {
      toast('error', 'Không thể tải danh sách khoa.');
    } finally {
      setLoadingFaculties(false);
    }
  }

  function openCreate() {
    createDialog.current?.showModal();
    void loadFaculties();
  }

  async function createAccount(form: HTMLFormElement) {
    if (saving) return;
    const payload = Object.fromEntries(new FormData(form));
    setSaving(true);
    try {
      const response = await fetch('/api/backend/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const { message } = await response.json() as { message?: string };
        toast('error', message ?? 'Không thể tạo tài khoản.');
        return;
      }
      createDialog.current?.close();
      loadPage(1);
      toast('success', payload.role === 'user' ? 'Đã tạo tài khoản. Người dùng cần đăng ký khuôn mặt khi đăng nhập lần đầu.' : 'Đã tạo tài khoản.');
    } catch {
      toast('error', 'Không thể kết nối dịch vụ quản lý tài khoản.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAccount(form: FormData) {
    if (!detail || saving) return;
    setSaving(true);
    const faculty = form.get('faculty');
    try {
      const response = await fetch(`/api/backend/users/${detail.id_nguoi_dung}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'), email: form.get('email'), phone: String(form.get('phone') ?? '').trim() || null,
          ...(faculty && { faculty }),
        }),
      });
      if (!response.ok) {
        const { message } = await response.json() as { message?: string };
        toast('error', message ?? 'Không thể cập nhật tài khoản.');
        return;
      }
      setDetail(await response.json() as Account);
      setEditing(false);
      loadPage(1);
      toast('success', 'Đã cập nhật thông tin tài khoản.');
    } catch {
      toast('error', 'Không thể kết nối dịch vụ quản lý tài khoản.');
    } finally {
      setSaving(false);
    }
  }

  const facultyOptions = faculties?.map((item) => <option key={item.id_khoa} value={item.id_khoa}>{item.ten_khoa}</option>);
  const facultyPlaceholder = loadingFaculties ? 'Đang tải danh sách khoa…' : faculties?.length === 0 ? 'Chưa có dữ liệu khoa' : 'Chọn khoa';
  const facultyRetry = !faculties && !loadingFaculties && <button type="button" className="text-button" onClick={() => void loadFaculties()}>Tải lại danh sách khoa</button>;

  return <>
    <div className="accounts-controls">
    <form className="workspace-toolbar accounts-toolbar" onSubmit={(event) => {
      event.preventDefault();
      const params = new URLSearchParams();
      for (const [field, value] of new FormData(event.currentTarget)) {
        if (typeof value === 'string' && value.trim()) params.set(field, value.trim());
      }
      loadPage(1, params.toString());
    }}>
      <label className="field">Tìm tài khoản<input type="search" name="search" maxLength={150} /></label>
      <label className="field">Vai trò<SelectField name="role"><option value="">Tất cả</option>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField></label>
      <button className="button button-outline" type="submit">Áp dụng</button>
      <button className="button button-primary" type="button" onClick={openCreate}>Tạo tài khoản</button>
    </form>
    <div className="accounts-import-action"><AccountImport onImported={() => loadPage(1)} /></div>
    </div>

    {result?.items.length ? <>
        <div className="surface workspace-table accounts-table" role="region" aria-label="Danh sách tài khoản" tabIndex={0}>
          <table><caption>Tài khoản hệ thống ({result.total})</caption><thead><tr>
            <th scope="col">Họ và tên</th><th scope="col">Tên đăng nhập</th><th scope="col">Email</th><th scope="col">Số điện thoại</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th>
          </tr></thead><tbody>{result.items.map((account) => <tr key={account.id_nguoi_dung}>
            <td>{account.ho_ten}</td><td>{account.ten_dang_nhap}</td><td>{account.email}</td><td>{account.so_dien_thoai ?? 'Chưa có'}</td>
            <td>{roles[account.vai_tro.ten_vai_tro] ?? 'Chưa xác định'}</td><td>{statuses[account.trang_thai] ?? 'Chưa xác định'}</td>
            <td><button className="text-button" type="button" disabled={opening} aria-label={`Xem chi tiết tài khoản ${account.ten_dang_nhap}`} onClick={() => void openAccount(account.id_nguoi_dung)}>Xem chi tiết</button></td>
          </tr>)}</tbody></table>
        </div>
      </> : !loading && !failed && <div className="surface workspace-empty"><p>Không tìm thấy tài khoản phù hợp.</p></div>}
    {hasMore && <div ref={more} className="accounts-scroll-end" />}
    {loading && <p role="status">Đang tải danh sách tài khoản…</p>}
    {failed && <div className="surface workspace-empty"><p role="alert">Không thể tải danh sách tài khoản.</p><button type="button" className="button button-outline" onClick={() => loadPage(page)}>Thử lại</button></div>}

    <dialog ref={createDialog} className="surface account-detail-dialog" aria-labelledby="account-create-title"
      onCancel={(event) => { if (saving) event.preventDefault(); }}
      onClose={(event) => event.currentTarget.querySelector('form')?.reset()}>
      <h2 id="account-create-title">Tạo tài khoản</h2>
      <form onSubmit={(event) => { event.preventDefault(); void createAccount(event.currentTarget); }}>
        <fieldset className="account-form-grid" disabled={saving}>
          <label className="field">Tên đăng nhập<input name="username" maxLength={100} required /></label>
          <label className="field">Mật khẩu tạm<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
          <label className="field">Họ và tên<input name="name" maxLength={150} required /></label>
          <label className="field">Email<input name="email" type="email" maxLength={150} required /></label>
          <label className="field">Khoa<SelectField name="faculty" defaultValue="" disabled={loadingFaculties || !faculties?.length}><option value="" disabled>{facultyPlaceholder}</option>{facultyOptions}</SelectField></label>
          <label className="field">Vai trò<SelectField name="role"><option value="user">{roles.user}</option><option value="staff">{roles.staff}</option></SelectField></label>
        </fieldset>
        {loadingFaculties && <p role="status">Đang tải danh sách khoa…</p>}
        {facultyRetry}
        <div className="face-guide-actions">
          <button type="button" className="button button-outline" disabled={saving} onClick={() => createDialog.current?.close()}>Hủy</button>
          <button className="button button-primary" disabled={saving}>{saving ? 'Đang tạo…' : 'Tạo tài khoản'}</button>
        </div>
      </form>
    </dialog>

    <dialog ref={dialog} className="surface account-detail-dialog" aria-labelledby="account-detail-title" onCancel={(event) => { if (saving) event.preventDefault(); }}>
      <h2 id="account-detail-title">Chi tiết tài khoản</h2>
      {detail && editing ? <form onSubmit={(event) => { event.preventDefault(); void saveAccount(new FormData(event.currentTarget)); }}>
        <label className="field">Họ và tên<input name="name" defaultValue={detail.ho_ten} maxLength={150} required disabled={saving} /></label>
        <label className="field">Email<input type="email" name="email" defaultValue={detail.email} maxLength={150} required readOnly={detail.trang_thai === 'pending_activation'} disabled={saving} /></label>
        <label className="field">Số điện thoại<input type="tel" name="phone" defaultValue={detail.so_dien_thoai ?? ''} maxLength={20} disabled={saving} /></label>
        <div className="account-form-grid">
          <label className="field">Khoa<SelectField name="faculty" value={editFaculty} disabled={saving || loadingFaculties || !faculties?.length} onChange={(event) => setEditFaculty(event.target.value)}>
            <option value="" disabled>{facultyPlaceholder}</option>
            {detail.id_khoa && !faculties?.some((item) => item.id_khoa === detail.id_khoa) && <option value={detail.id_khoa}>{detail.khoa?.ten_khoa ?? detail.id_khoa}</option>}
            {facultyOptions}
          </SelectField></label>
        </div>
        {facultyRetry}
        <div className="face-guide-actions">
          <button type="button" className="button button-outline" disabled={saving} onClick={() => setEditing(false)}>Hủy</button>
          <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
        </div>
        {saving && <p role="status">Đang cập nhật tài khoản…</p>}
      </form> : detail && <dl className="activity-facts account-detail-grid">
        <div><dt>Mã tài khoản</dt><dd>{detail.id_nguoi_dung}</dd></div><div><dt>Họ và tên</dt><dd>{detail.ho_ten}</dd></div>
        <div><dt>Tên đăng nhập</dt><dd>{detail.ten_dang_nhap}</dd></div><div><dt>Email</dt><dd>{detail.email}</dd></div>
        <div><dt>Số điện thoại</dt><dd>{detail.so_dien_thoai ?? 'Chưa có'}</dd></div><div><dt>Khoa</dt><dd>{detail.khoa?.ten_khoa ?? 'Chưa có'}</dd></div>
        <div><dt>Loại người dùng</dt><dd>{types[detail.loai_nguoi_dung ?? ''] ?? 'Chưa xác định'}</dd></div>
        <div><dt>Vai trò</dt><dd>{roles[detail.vai_tro.ten_vai_tro] ?? 'Chưa xác định'}</dd></div>
        <div><dt>Trạng thái</dt><dd>{statuses[detail.trang_thai] ?? 'Chưa xác định'}</dd></div>
      </dl>}
      {!editing && <form method="dialog" className="face-guide-actions">
        <button type="submit" className="button button-outline">Đóng</button>
        {detail && <button type="button" className="button button-primary" onClick={() => {
          setEditFaculty(detail.id_khoa ?? '');
          setEditing(true);
          void loadFaculties();
        }}>Chỉnh sửa</button>}
      </form>}
    </dialog>
  </>;
}
