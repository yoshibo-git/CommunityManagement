'use client';

import { useEffect, useRef, useState } from 'react';

function cameraError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Camera bị chặn. Hãy cấp quyền camera trong trình duyệt rồi thử lại.';
    if (error.name === 'NotFoundError') return 'Không tìm thấy camera. Hãy kết nối camera rồi thử lại.';
    if (error.name === 'NotReadableError') return 'Không thể mở camera. Hãy đóng ứng dụng đang dùng camera rồi thử lại.';
  }
  return 'Không thể mở camera. Vui lòng thử lại.';
}

export function FaceEnrollment({ ticket, purpose, onComplete, onCancel }: {
  ticket: string;
  purpose: 'enroll' | 'verify';
  onComplete: (userId: number) => Promise<void>;
  onCancel: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const [camera, setCamera] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [opening, setOpening] = useState(0);
  const [pending, setPending] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const enrolling = purpose === 'enroll';

  useEffect(() => {
    if (registered) confirmation.current?.showModal();
  }, [registered]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setExpired(true);
      setOpening(0);
    }, 300_000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!opening) return;
    let active = true;
    let stream: MediaStream | undefined;
    const preview = video.current;
    if (!preview) return;
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        preview.srcObject = stream;
        await preview.play();
        if (active) setCamera('ready');
      } catch (cause) {
        stream?.getTracks().forEach((track) => track.stop());
        if (active) {
          setError(navigator.mediaDevices ? cameraError(cause) : 'Hãy mở trang qua localhost hoặc HTTPS để dùng camera.');
          setCamera('error');
        }
      }
    })();
    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
      preview.srcObject = null;
    };
  }, [opening]);

  async function capture() {
    const preview = video.current;
    if (!preview?.videoWidth || pending || expired) return;
    setPending(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1280 / Math.max(preview.videoWidth, preview.videoHeight));
      canvas.width = Math.round(preview.videoWidth * scale);
      canvas.height = Math.round(preview.videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Capture unavailable');
      context.drawImage(preview, 0, 0, canvas.width, canvas.height);
      const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!jpeg) throw new Error('Capture unavailable');
      const form = new FormData();
      form.set('image', jpeg, 'capture.jpg');
      const route = enrolling ? 'face/enroll' : 'login/face';
      const response = await fetch(`/api/backend/auth/${route}`, {
        method: 'POST', headers: { Authorization: `Bearer ${ticket}` }, body: form,
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 429) {
          setExpired(true);
          setOpening(0);
          return;
        }
        const payload = await response.json() as { message?: string };
        setError(payload.message ?? 'Không thể xử lý ảnh khuôn mặt.');
        return;
      }
      if (enrolling) {
        const result = await response.json() as { registered?: boolean };
        if (result.registered !== true) throw new Error('Enrollment not confirmed');
        setOpening(0);
        setRegistered(true);
      } else {
        const result = await response.json() as { id?: number };
        if (typeof result.id !== 'number' || !Number.isSafeInteger(result.id) || result.id <= 0) throw new Error('Session not confirmed');
        await onComplete(result.id);
        setOpening(0);
      }
    } catch {
      setError(enrolling ? 'Không thể xác nhận đã lưu mẫu khuôn mặt. Vui lòng thử lại.' : 'Không thể xác nhận phiên đăng nhập. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  if (registered) return <div className="auth-card surface">
    <h1>Đăng ký khuôn mặt</h1>
    <dialog ref={confirmation} className="surface face-guide" aria-labelledby="face-enrollment-success" onCancel={(event) => event.preventDefault()}>
      <h2 id="face-enrollment-success">Đăng ký khuôn mặt thành công!</h2>
      <p>Bạn đã đăng ký Face ID thành công. Vui lòng quay lại trang đăng nhập để xác thực khuôn mặt và truy cập hệ thống.</p>
      <div className="face-guide-actions">
        <button type="button" className="button button-primary" onClick={() => {
          confirmation.current?.close();
          setAcknowledged(true);
        }}>Đồng ý</button>
      </div>
    </dialog>
    {acknowledged && <button type="button" className="button button-primary" onClick={onCancel}>Quay lại đăng nhập</button>}
  </div>;

  return <div className="auth-card surface face-scan">
    <h1>{enrolling ? 'Đăng ký khuôn mặt' : 'Xác thực khuôn mặt'}</h1>
    <p id="face-scan-guide">Cấp quyền camera khi được hỏi. Chọn nơi đủ sáng, nhìn thẳng và đặt khuôn mặt vào giữa khung.{enrolling && ' Hệ thống lưu mẫu mã hóa sau khi đăng ký.'}</p>
    <div className="face-guide-preview" hidden={camera !== 'ready' || expired}>
      <video ref={video} muted playsInline aria-label="Hình ảnh xem trước từ camera" aria-describedby="face-scan-guide" />
    </div>
    {camera === 'loading' && !expired && <p role="status">Đang chờ quyền truy cập camera…</p>}
    {expired && <p className="form-error" role="alert">{enrolling ? 'Phiên đăng ký' : 'Phiên xác thực'} đã hết hạn hoặc hết lượt thử. Vui lòng đăng nhập lại.</p>}
    {error && !expired && <p className="form-error" role="alert">{error}</p>}
    <div className="face-guide-actions">
      <button className="button button-outline" type="button" disabled={pending} onClick={onCancel}>Quay về đăng nhập</button>
      {!expired && (camera === 'ready'
        ? <button className="button button-primary" type="button" disabled={pending} onClick={() => void capture()}>{pending ? 'Đang xử lý…' : enrolling ? 'Chụp và đăng ký' : 'Chụp và xác thực'}</button>
        : <button className="button button-primary" type="button" disabled={camera === 'loading'} onClick={() => {
          setError('');
          setCamera('loading');
          setOpening((value) => value + 1);
        }}>{camera === 'error' ? 'Thử mở lại camera' : 'Mở camera'}</button>)}
    </div>
  </div>;
}
