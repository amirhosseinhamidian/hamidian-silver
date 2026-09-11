import '@testing-library/jest-dom/vitest';
import type { ImgHTMLAttributes } from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.mock('next/image', async () => {
  const React = await import('react');

  return {
    default: (props: Record<string, unknown>) => {
      const imageProps = { ...props };

      delete imageProps.blurDataURL;
      delete imageProps.fill;
      delete imageProps.placeholder;
      delete imageProps.preload;
      delete imageProps.priority;

      return React.createElement('img', imageProps as ImgHTMLAttributes<HTMLImageElement>);
    },
  };
});

afterEach(() => {
  cleanup();
});
