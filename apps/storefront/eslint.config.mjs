import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'alert', message: 'Use the storefront toast pattern instead.' },
        { name: 'confirm', message: 'Use an accessible storefront dialog instead.' },
        { name: 'prompt', message: 'Use an accessible storefront dialog instead.' },
      ],
      'no-restricted-properties': [
        'error',
        ...['window', 'globalThis'].flatMap((object) => [
          { object, property: 'alert', message: 'Use the storefront toast pattern instead.' },
          { object, property: 'confirm', message: 'Use an accessible storefront dialog instead.' },
          { object, property: 'prompt', message: 'Use an accessible storefront dialog instead.' },
        ]),
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    // Playwright runs Next.js with a separate distDir; generated files are not source.
    '.next-e2e/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
