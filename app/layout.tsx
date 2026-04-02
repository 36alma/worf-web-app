import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import type {Viewport} from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html suppressHydrationWarning data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
