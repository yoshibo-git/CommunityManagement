'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth-context';
import { Icon } from './icon';
import type { WorkspaceData } from '@/lib/workspace';

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<WorkspaceData['notifications']>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    void fetch('/api/backend/notifications', { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!controller.signal.aborted) { setItems(data.items); setError(false); setLoading(false); }
    }).catch(() => { if (!controller.signal.aborted) { setError(true); setLoading(false); } });
    return () => controller.abort();
  }, [user]);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); };
  }, [open]);
  if (!user) return null;
  const unread = items.filter((item) => !item.read).length;
  return <div ref={root} className="header-notifications" onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className="icon-button" aria-label={`Thông báo: ${unread} chưa đọc`} aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="bell" />{unread > 0 && <span className="notification-count">{unread}</span>}</button>
    {open && <section className="notification-panel" aria-label="Thông báo"><h2>Thông báo</h2>{loading ? <p role="status">Đang tải thông báo…</p> : error ? <p role="alert">Không thể tải thông báo. Vui lòng tải lại trang.</p> : items.length ? <ul>{items.map((item) => <li key={item.id}><strong>{item.title}</strong><p>{item.content}</p><time dateTime={item.createdAt}>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(item.createdAt))}</time></li>)}</ul> : <p>Chưa có thông báo.</p>}</section>}
  </div>;
}
