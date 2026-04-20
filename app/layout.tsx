import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import type {Viewport} from 'next';
import {Analytics} from '@vercel/analytics/next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html suppressHydrationWarning data-theme="dark">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
