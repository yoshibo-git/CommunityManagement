'use client';

import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';
import { AuthProvider } from './auth-context';

export function SiteFrame({ children }: { children: React.ReactNode }) {
  return <AuthProvider>
    <SiteHeader />
    <main id="noi-dung" tabIndex={-1}>{children}</main>
    <SiteFooter />
  </AuthProvider>;
}
