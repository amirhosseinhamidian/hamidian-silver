import type { Metadata } from 'next';
import localFont from 'next/font/local';

import './globals.css';
import { DashboardShell } from '@/components/layout/DashboardShell';

const vazirmatn = localFont({
  src: '../fonts/Vazirmatn/Vazirmatn[wght].ttf',
  variable: '--font-vazirmatn',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Hamidian Silver Admin',
  description: 'Administration panel',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full antialiased`}>
      <body className="min-h-full">
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
