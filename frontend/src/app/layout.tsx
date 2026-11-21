import type { Metadata } from 'next';
import { SiteFrame } from '@/components/site-frame';
import { ToastProvider } from '@/components/toast';
import 'leaflet/dist/leaflet.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'CM UTE — Hoạt động cộng đồng', template: '%s | CM UTE' },
  description: 'Kết nối sinh viên, nhà trường và các đơn vị trong những hoạt động vì cộng đồng.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi" data-scroll-behavior="smooth"><body><a className="skip-link" href="#noi-dung">Chuyển đến nội dung chính</a><ToastProvider><SiteFrame>{children}</SiteFrame></ToastProvider></body></html>;
}
