import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html suppressHydrationWarning data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
