import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function token(source: string, name: string): string {
  const match = source.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`Missing color token: ${name}`);
  return match[1];
}

describe('admin accessibility color tokens', () => {
  const source = readFileSync(join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8');
  const surface = token(source, 'admin-color-surface');

  it.each(['admin-color-ink', 'admin-color-muted', 'admin-color-subtle'])(
    '%s has WCAG AA text contrast',
    (name) => {
      expect(contrast(token(source, name), surface)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([
    'admin-color-primary',
    'admin-color-success',
    'admin-color-warning',
    'admin-color-danger',
    'admin-color-info',
  ])('%s has sufficient non-text contrast', (name) => {
    expect(contrast(token(source, name), surface)).toBeGreaterThanOrEqual(3);
  });
});
