import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Anees Super-admin Console',
  description: 'Internal sensor fleet operations console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Browser recorders/extensions may add attributes to <html> before hydration.
  return (
    <html lang="en" suppressHydrationWarning>
      <body><SessionProvider>{children}</SessionProvider></body>
    </html>
  );
}
