import type { Metadata } from 'next';
import localFont from 'next/font/local';

import { LuxuryHeader } from '@/components/layout/header/LuxuryHeader';
import { LuxuryFooter } from '@/components/layout/footer/LuxuryFooter';
import { AuthProvider } from '@/providers/AuthProvider';
import './globals.css';
import { AuthModalProvider } from '@/components/auth/AuthModalProvider';

const peyda = localFont({
  src: [
    {
      path: '../fonts/Peyda/peyda-light.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../fonts/Peyda/Peyda-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/Peyda/Peyda-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/Peyda/Peyda-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-peyda',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Hamidian Silver',
  description: 'Luxury silver jewelry',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fa" dir="rtl" className={`${peyda.variable} h-full antialiased`}>
      <body
        className="
          min-h-full
          flex
          flex-col
          font-(--font-peyda)
        "
      >
        <AuthProvider>
          <AuthModalProvider>
            <LuxuryHeader />

            <main className="flex-1">{children}</main>

            <LuxuryFooter />
          </AuthModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
