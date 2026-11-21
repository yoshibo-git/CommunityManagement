'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from './icon';

const variants = {
  success: { icon: 'check', label: 'Thành công', duration: 3000 },
  error: { icon: 'warning', label: 'Lỗi', duration: 5000 },
  warning: { icon: 'warning', label: 'Cảnh báo', duration: 5000 },
  info: { icon: 'info', label: 'Thông tin', duration: 3000 },
} as const;
type ToastKind = keyof typeof variants;
type Toast = { id: number; kind: ToastKind; message: string };
const ToastContext = createContext<((kind: ToastKind, message: string) => void) | null>(null);

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  const [closing, setClosing] = useState(false);
  const { id, kind, message } = toast;
  const { icon, label, duration } = variants[kind];
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (closing) dismiss(id);
      else setClosing(true);
    }, closing ? 150 : duration);
    return () => window.clearTimeout(timer);
  }, [closing, dismiss, duration, id]);

  return <li className={`toast toast-${kind}${closing ? ' toast-closing' : ''}`}>
    <Icon name={icon} />
    <span>{message}</span>
    <button type="button" aria-label={`Đóng thông báo ${label.toLowerCase()}: ${message}`} onClick={() => setClosing(true)}><Icon name="close" /></button>
  </li>;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const show = useCallback((kind: ToastKind, message: string) => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, kind, message }]);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  return <ToastContext.Provider value={show}>
    {children}
    <div className="toast-announcements">
      <div role="status" aria-live="polite" aria-atomic="false">
        {toasts.filter(({ kind }) => kind !== 'error').map(({ id, kind, message }) => <div key={id}>{variants[kind].label}: {message}</div>)}
      </div>
      <div aria-live="assertive">
        {toasts.filter(({ kind }) => kind === 'error').map(({ id, message }) => <div key={id}>Lỗi: {message}</div>)}
      </div>
    </div>
    {toasts.length > 0 && <ul aria-label="Thông báo thao tác" className="toast-stack">
      {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />)}
    </ul>}
  </ToastContext.Provider>;
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('ToastProvider is required.');
  return show;
}
