'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { WorkspaceData } from '@/lib/workspace';
import { Icon } from './icon';

type User = WorkspaceData['user'];
async function readSession(): Promise<User | null> {
  const response = await fetch('/api/backend/auth/session', { cache: 'no-store' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Session unavailable.');
  return response.json() as Promise<User>;
}
const AuthContext = createContext<{ user: User | null; status: 'loading' | 'ready' | 'error'; reload: () => Promise<void>; logout: () => Promise<void> } | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const pathname = usePathname();
  const router = useRouter();
  const reload = useCallback(async () => {
    setUser(await readSession());
    setStatus('ready');
  }, []);
  useEffect(() => {
    let active = true;
    void readSession().then((value) => { if (active) { setUser(value); setStatus('ready'); } }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [pathname]);
  async function logout() {
    const response = await fetch('/api/backend/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!response.ok) throw new Error('Không thể đăng xuất. Vui lòng thử lại.');
    setUser(null);
    setStatus('ready');
    router.replace('/login');
    router.refresh();
  }
  return <AuthContext.Provider value={{ user, status, reload, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required.');
  return context;
}

export function LogoutButton({ className = 'text-button', showIcon = false, onLogout }: { className?: string; showIcon?: boolean; onLogout?: () => void }) {
  const { logout } = useAuth();
  const [error, setError] = useState('');
  return <><button type="button" className={className} onClick={() => { setError(''); void logout().then(onLogout).catch(() => setError('Không thể đăng xuất. Vui lòng thử lại.')); }}>{showIcon && <Icon name="logout" />}Đăng xuất</button>{error && <p role="alert">{error}</p>}</>;
}
