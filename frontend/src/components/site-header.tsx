'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { Icon } from './icon';
import { useAuth } from './auth-context';
import { AccountMenu } from './account-menu';
import { NotificationBell } from './notification-bell';

const navigation = [
  { href: '/', label: 'Trang chủ' },
  { href: '/#bang-tin', label: 'Tin tức' },
  { href: '/#lien-he', label: 'Liên hệ' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, status } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const links = navigation.map(({ href, label }) => (
    <Link key={href} href={href} aria-current={href === pathname ? 'page' : undefined} onClick={() => dialog.current?.close()}>{label}</Link>
  ));
  const actions = <>
    {!user && status === 'ready' && <Link href="/proposals" className="button button-outline" aria-current={pathname === '/proposals' ? 'page' : undefined} onClick={() => dialog.current?.close()}>Đề xuất hoạt động</Link>}
    {user ? <div className="signed-in-actions"><NotificationBell /><AccountMenu onNavigate={() => dialog.current?.close()} /></div> : status === 'ready' && <Link href="/login" className="button button-primary" aria-current={pathname === '/login' ? 'page' : undefined} onClick={() => dialog.current?.close()}>Đăng nhập</Link>}
  </>;

  return <>
    <div className="institution-bar"><div className="container">Trường Đại học Sư phạm Kỹ thuật<span>Kết nối nhà trường và cộng đồng</span></div></div>
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/" aria-label="CM UTE — Trang chủ"><strong>CM <span>UTE</span></strong><span>Hoạt động cộng đồng</span></Link>
        <nav className="desktop-nav" aria-label="Điều hướng chính">{links}</nav>
        <div className="header-actions">{actions}</div>
        <button className="icon-button menu-trigger" type="button" aria-label="Mở menu" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => { dialog.current?.showModal(); setOpen(true); }}><Icon name="menu" /></button>
      </div>
      <dialog id="mobile-navigation" ref={dialog} className="mobile-drawer" onClose={() => setOpen(false)} aria-labelledby="menu-title" onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')).filter((control) => control.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
        <div className="drawer-heading"><strong id="menu-title">Điều hướng</strong><button className="icon-button" type="button" aria-label="Đóng menu" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
        <nav aria-label="Điều hướng di động">{links}<div className="drawer-actions">{actions}</div></nav>
        <p className="drawer-note">Cùng kết nối, cùng tạo nên những giá trị tốt đẹp.</p>
      </dialog>
    </header>
  </>;
}
