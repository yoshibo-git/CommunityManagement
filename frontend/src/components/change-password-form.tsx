'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from './auth-context';
import { useToast } from './toast';

export function ChangePasswordForm() {
  const { reload } = useAuth();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState('');

  if (changed) return <div className="password-change-success">
    <p>Vui lòng đăng nhập lại bằng mật khẩu mới.</p>
    <Link href="/login" className="button button-primary">Đăng nhập lại</Link>
  </div>;

  return <form method="post" autoComplete="off" aria-label="Đổi mật khẩu" onSubmit={async (event) => {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const { currentPassword, newPassword, confirmPassword } = Object.fromEntries(new FormData(form));
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không trùng với mật khẩu mới.');
      return;
    }
    setError('');
    setPending(true);
    try {
      const response = await fetch('/api/backend/auth/password/change', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const result = await response.json() as { changed?: boolean; message?: string };
      if (!response.ok || result.changed !== true) {
        const message = result.message ?? 'Không thể đổi mật khẩu. Vui lòng thử lại.';
        if (response.status === 400 || response.status === 422) setError(message);
        else toast('error', message);
        return;
      }
      setChanged(true);
      toast('success', 'Đã đổi mật khẩu.');
      await reload().catch(() => undefined);
    } catch {
      toast('error', 'Không thể kết nối dịch vụ. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }}>
    <fieldset disabled={pending}>
      <div className="field">
        <label htmlFor="current-password">Mật khẩu hiện tại</label>
        <input id="current-password" name="currentPassword" type="password" autoComplete="off" maxLength={1024} required />
      </div>
      <div className="field">
        <label htmlFor="new-password">Mật khẩu mới</label>
        <input id="new-password" name="newPassword" type="password" autoComplete="off" minLength={8} maxLength={1024} required />
      </div>
      <div className="field">
        <label htmlFor="confirm-password">Xác nhận mật khẩu mới</label>
        <input id="confirm-password" name="confirmPassword" type="password" autoComplete="off" minLength={8} maxLength={1024} required />
      </div>
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="activity-card-actions">
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? 'Đang đổi mật khẩu…' : 'Đổi mật khẩu'}</button>
    </div>
  </form>;
}
