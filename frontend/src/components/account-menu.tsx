'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { LogoutButton, useAuth } from './auth-context';
import { Icon } from './icon';

export function AccountMenu({ onNavigate }: { onNavigate: () => void }) {
  const { user } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape, true); };
  }, [open]);
  if (!user) return null;
  function close() { setOpen(false); onNavigate(); }
  return <div className="account-menu" ref={root} onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button className="button button-outline account-menu-trigger" ref={trigger} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><Icon name="user" /><span>{user.name}</span><Icon name="chevronDown" /></button>
    <nav id={id} className="account-menu-panel" aria-label="Tài khoản" hidden={!open}>
      <Link className="account-menu-item" href="/system?view=profile" prefetch={false} onClick={close}><Icon name="user" />Hồ sơ</Link>
      {user.role !== 'admin' && <Link className="account-menu-item" href="/system?view=activities" prefetch={false} onClick={close}><Icon name="calendar" />Hoạt động</Link>}
      {user.role === 'admin' && <Link className="account-menu-item" href="/system?view=accounts" prefetch={false} onClick={close}><Icon name="people" />Quản lý tài khoản</Link>}
      <LogoutButton className="account-menu-item" showIcon onLogout={close} />
    </nav>
  </div>;
}
