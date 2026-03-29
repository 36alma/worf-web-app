import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
