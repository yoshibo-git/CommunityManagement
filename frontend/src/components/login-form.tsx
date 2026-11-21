'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './icon';
import { useAuth } from './auth-context';
import { FaceEnrollment } from './face-enrollment';
import { useToast } from './toast';

export function LoginForm() {
  const router = useRouter();
  const { reload } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const [faceStep, setFaceStep] = useState<{ ticket: string; purpose: 'enroll' | 'verify' } | null>(null);
  if (faceStep) return <FaceEnrollment {...faceStep} onCancel={() => {
    setFaceStep(null);
    router.replace('/login');
  }} onComplete={async (userId) => {
    if ((await reload())?.id !== userId) throw new Error('Session unavailable');
    router.replace('/');
    router.refresh();
  }} />;
  return <div className="auth-card surface"><h1>Đăng nhập</h1><p className="page-description">Sử dụng tài khoản do nhà trường cấp.</p>
    <form aria-label="Đăng nhập" onSubmit={async (event) => {
      event.preventDefault();
      if (pending) return;
      setPending(true);
      const form = new FormData(event.currentTarget);
      try {
        const response = await fetch('/api/backend/auth/login/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
        if (!response.ok) {
          const body = await response.json() as { message?: string };
          toast('error', body.message ?? 'Không thể đăng nhập.');
          return;
        }
        const user = await response.json() as { id?: number; role: string; step?: string; ticket?: string };
        if (user.ticket && (user.step === 'face_enrollment_required' || user.step === 'face_verification_required')) {
          setFaceStep({ ticket: user.ticket, purpose: user.step === 'face_enrollment_required' ? 'enroll' : 'verify' });
          return;
        }
        if (!user.id || (await reload())?.id !== user.id) throw new Error('Session unavailable');
        router.replace(user.role === 'admin' ? '/system' : '/'); router.refresh();
      } catch { toast('error', 'Không thể kết nối dịch vụ đăng nhập. Vui lòng thử lại.'); }
      finally { setPending(false); }
    }}>
      <div className="field"><label htmlFor="username">Mã sinh viên / Mã nhân sự</label><input id="username" name="username" autoComplete="username" maxLength={100} placeholder="Nhập mã tài khoản của bạn" required disabled={pending} /></div>
      <div className="field"><label htmlFor="password">Mật khẩu</label><div className="password-input"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Nhập mật khẩu" required disabled={pending} /><button className="icon-button" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}><Icon name={showPassword ? 'eyeOff' : 'eye'} /></button></div></div>
      <div className="recovery-links"><button type="button" className="text-button" onClick={() => toast('info', 'Hệ thống đang cập nhật. Vui lòng thử lại sau.')}>Quên mật khẩu?</button></div>
      <button className="button button-primary full-width" type="submit" disabled={pending}>{pending ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
    </form>
  </div>;
}
