import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';
import { AuthProvider } from './auth-context';
import { backendUrl, sessionHeaders } from '@/lib/backend';
import type { WorkspaceData } from '@/lib/workspace';

export async function SiteFrame({ children }: { children: React.ReactNode }) {
  const headers = await sessionHeaders();
  let user: WorkspaceData['user'] | null = null;
  if (headers.Cookie) {
    const response = await fetch(backendUrl('auth/session'), {
      headers, cache: 'no-store', signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    if (response?.ok) user = await response.json() as WorkspaceData['user'];
  }
  return <AuthProvider initialUser={user}>
    <SiteHeader />
    <main id="noi-dung" tabIndex={-1}>{children}</main>
    <SiteFooter />
  </AuthProvider>;
}
