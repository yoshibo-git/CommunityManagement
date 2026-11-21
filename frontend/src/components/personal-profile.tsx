'use client';

import { useState } from 'react';
import type { WorkspaceData } from '@/lib/workspace';
import { useToast } from './toast';

export function PersonalProfile({ user }: { user: WorkspaceData['user'] }) {
  const toast = useToast();
  const [phone, setPhone] = useState(user.phone);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const type = user.type === 'student' ? 'Sinh viên' : user.type === 'staff' ? 'Cán bộ' : 'Chưa xác định';

  return <section className="surface profile-card">
    <div className="profile-header">
      <h2>Thông tin cá nhân</h2>
      {!editing && <button type="button" className="button button-outline" onClick={() => {
        setDraft(phone ?? '');
        setEditing(true);
      }}>Chỉnh sửa</button>}
    </div>
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (!editing || pending) return;
      setPending(true);
      setError('');
      try {
        const response = await fetch('/api/backend/users/me', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: draft.trim() || null }),
        });
        const result = await response.json() as { phone?: string | null; message?: string };
        if (!response.ok || (result.phone !== null && typeof result.phone !== 'string')) {
          const message = result.message ?? 'Không thể lưu số điện thoại. Vui lòng thử lại.';
          if (response.status === 400 || response.status === 422) setError(message);
          else toast('error', message);
          return;
        }
        setPhone(result.phone);
        setEditing(false);
        toast('success', 'Đã lưu số điện thoại.');
      } catch {
        toast('error', 'Không thể kết nối dịch vụ. Vui lòng thử lại.');
      } finally {
        setPending(false);
      }
    }}>
      <dl className="activity-facts">
        <div><dt>Họ và tên</dt><dd>{user.name}</dd></div>
        <div><dt>Loại người dùng</dt><dd>{type}</dd></div>
        <div><dt>Email</dt><dd>{user.email}</dd></div>
        <div>
          <dt>{editing ? <label htmlFor="profile-phone">Số điện thoại</label> : 'Số điện thoại'}</dt>
          <dd>{editing
            ? <input id="profile-phone" type="tel" autoComplete="tel" maxLength={20} value={draft} disabled={pending} onChange={(event) => setDraft(event.target.value)} />
            : phone || 'Chưa cập nhật'}</dd>
        </div>
        <div><dt>Khoa</dt><dd>{user.faculty || 'Chưa phân khoa'}</dd></div>
      </dl>
      {error && <p className="form-error" role="alert">{error}</p>}
      {editing && <div className="activity-card-actions">
        <button className="button button-primary" type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu'}</button>
        <button className="button button-outline" type="button" disabled={pending} onClick={() => {
          setError('');
          setEditing(false);
        }}>Quay lại</button>
      </div>}
    </form>
  </section>;
}
