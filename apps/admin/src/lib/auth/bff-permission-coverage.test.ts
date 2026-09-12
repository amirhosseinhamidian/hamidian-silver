import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

const APP_ROOT = join(process.cwd(), 'src');
const API_ROUTES_ROOT = join(APP_ROOT, 'app', 'api');

function collectFiles(directory: string, suffix: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path, suffix);
    return entry.name.endsWith(suffix) ? [path] : [];
  });
}

describe('admin BFF authorization coverage', () => {
  it('keeps protected route handlers as thin delegates without direct upstream fetches', () => {
    const violations: string[] = [];
    const protectedRoutes = collectFiles(API_ROUTES_ROOT, 'route.ts').filter((file) => {
      const route = relative(API_ROUTES_ROOT, file);
      return !route.startsWith(`auth${sep}`) && route !== join('health', 'route.ts');
    });

    for (const file of protectedRoutes) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes("from '@/lib/") || /\bfetch\s*\(/.test(source)) {
        violations.push(relative(APP_ROOT, file));
      }
    }

    expect(violations, `Unsafe admin route handlers:\n${violations.join('\n')}`).toEqual([]);
  });

  it('keeps the public healthcheck local and limited to GET', () => {
    const source = readFileSync(join(API_ROUTES_ROOT, 'health', 'route.ts'), 'utf8');

    expect(source).toContain('export function GET()');
    expect(source).toContain("new Response('ok'");
    expect(source).not.toContain("from '@/lib/");
    expect(source).not.toMatch(/\bfetch\s*\(|\bcookies\s*\(|SESSION_COOKIE_NAME/);
    expect(source).not.toMatch(
      /\bexport\s+(?:(?:async\s+)?function|const)\s+(?:POST|PUT|PATCH|DELETE)\b/,
    );
  });

  it('requires a session cookie in every protected BFF before forwarding upstream', () => {
    const violations: string[] = [];
    const bffFiles = collectFiles(join(APP_ROOT, 'lib'), '-bff.ts').filter(
      (file) => !file.endsWith(join('auth', 'bff.ts')),
    );

    for (const file of bffFiles) {
      const source = readFileSync(file, 'utf8');
      const hasSessionGate =
        source.includes('SESSION_COOKIE_NAME') &&
        source.includes('cookies()') &&
        /status:\s*401/.test(source);
      if (!hasSessionGate) violations.push(relative(APP_ROOT, file));
    }

    expect(violations, `BFF modules missing a session gate:\n${violations.join('\n')}`).toEqual([]);
  });
});
