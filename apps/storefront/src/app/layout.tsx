import { peyda } from '@/styles/fonts';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'نقره حمیدیان',
    template: '%s | نقره حمیدیان',
  },
  description: 'فروشگاه آنلاین و گالری نقره حمیدیان',
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="fa" dir="rtl" className={peyda.variable}>
      <body>{children}</body>
    </html>
  );
}
