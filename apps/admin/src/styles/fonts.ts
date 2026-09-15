import localFont from 'next/font/local';

export const vazirmatn = localFont({
  src: '../assets/fonts/Vazirmatn[wght].ttf',
  display: 'swap',
  preload: true,
  variable: '--font-vazirmatn',
  weight: '100 900',
  style: 'normal',
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
});
