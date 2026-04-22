import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import type { Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children, locale }: { children: React.ReactNode, locale: string }) {
  return (
    <html suppressHydrationWarning data-theme="dark" lang={locale}>
      <head><title>WORF</title></head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
