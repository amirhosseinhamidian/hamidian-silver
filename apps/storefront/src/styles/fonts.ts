import localFont from 'next/font/local';

export const peyda = localFont({
  src: [
    {
      path: '../assets/fonts/peyda/Peyda-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../assets/fonts/peyda/Peyda-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../assets/fonts/peyda/Peyda-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../assets/fonts/peyda/Peyda-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
  preload: true,
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
  variable: '--font-peyda',
});
