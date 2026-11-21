'use client';

import { useRef, useState } from 'react';
import { useToast } from './toast';

type ImportRow = { line: number; username: string; name: string; email: string; faculty: string; role: string; errors: string[] };

export function AccountImport({ onImported }: { onImported: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  async function run(action: 'preview' | 'commit') {
    if (!file || pending) return;
    setPending(true);
    if (action === 'preview') setRows(null);
    try {
      const form = new FormData();
      form.set('file', file);
      const response = await fetch(`/api/backend/users/import/${action}`, { method: 'POST', body: form });
      const data = await response.json() as { message?: string; items?: ImportRow[]; created?: number };
      if (!response.ok) {
        if (action === 'commit') setRows(null);
        toast('error', data.message ?? 'Không thể nhập tài khoản.');
        return;
      }
      if (action === 'preview' && data.items) setRows(data.items);
      if (action === 'commit' && typeof data.created === 'number') {
        dialog.current?.close();
        onImported();
        toast('success', `Đã tạo ${data.created} tài khoản.`);
      }
    } catch {
      toast('error', 'Không thể kết nối dịch vụ nhập tài khoản.');
    } finally {
      setPending(false);
    }
  }

  return <>
    <button className="button button-outline" type="button" onClick={() => dialog.current?.showModal()}>Nhập PDF/Excel</button>
    <dialog ref={dialog} className="surface account-detail-dialog account-import-dialog" aria-labelledby="account-import-title"
      onCancel={(event) => { if (pending) event.preventDefault(); }}
      onClose={(event) => {
        event.currentTarget.querySelector('form')?.reset();
        setFile(null);
        setRows(null);
      }}>
      <h2 id="account-import-title">Nhập tài khoản từ PDF/Excel</h2>
      <p>Hàng đầu tiên gồm 6 cột: Tên đăng nhập, Mật khẩu tạm, Họ và tên, Email, Mã khoa, Vai trò. Vai trò dùng mã <code>user</code> hoặc <code>staff</code>.</p>
      <p>Chọn tệp .xlsx hoặc PDF có bảng kẻ ô và văn bản chọn được. Tối đa 25 tài khoản và 1 MiB mỗi tệp. Lưu các ô Excel ở dạng văn bản. Có thể để trống mã khoa.</p>
      <form onSubmit={(event) => { event.preventDefault(); void run('preview'); }}>
        <label className="field">Tệp tài khoản<input type="file" accept=".xlsx,.pdf" disabled={pending} onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          setRows(null);
          if (selected && selected.size > 1024 * 1024) {
            toast('error', 'Tệp vượt quá dung lượng 1 MiB.');
            event.target.value = '';
            setFile(null);
            return;
          }
          setFile(selected);
        }} /></label>
        {rows && <div className="workspace-table" role="region" aria-label="Kết quả kiểm tra tệp" tabIndex={0}>
          <table><thead><tr><th scope="col">Dòng</th><th scope="col">Tên đăng nhập</th><th scope="col">Họ và tên</th><th scope="col">Email</th><th scope="col">Mã khoa</th><th scope="col">Vai trò</th><th scope="col">Kết quả</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.line}><td>{row.line}</td><td>{row.username}</td><td>{row.name}</td><td>{row.email}</td><td>{row.faculty || 'Chưa gán'}</td><td>{row.role === 'user' ? 'Người dùng' : row.role === 'staff' ? 'Quản lý' : 'Chưa hợp lệ'}</td><td>{row.errors.join(' ') || 'Hợp lệ'}</td></tr>)}</tbody>
          </table>
        </div>}
        {pending && <p role="status">Đang xử lý tệp…</p>}
        <div className="face-guide-actions">
          <button type="button" className="button button-outline" disabled={pending} onClick={() => dialog.current?.close()}>Đóng</button>
          <button type="submit" className="button button-outline" disabled={!file || pending}>Kiểm tra tệp</button>
          <button type="button" className="button button-primary" disabled={pending || !rows?.length || rows.some(({ errors }) => errors.length > 0)} onClick={() => void run('commit')}>Xác nhận nhập</button>
        </div>
      </form>
    </dialog>
  </>;
}
