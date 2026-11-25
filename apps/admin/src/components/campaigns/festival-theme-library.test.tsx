import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FestivalThemeLibrary } from './festival-theme-library';
import type { FestivalTheme } from './festival-theme-fields';

const initial: FestivalTheme = {
  background: '#1c1820',
  surface: '#272130',
  foreground: '#ffffff',
  accent: '#ffcdea',
  decoration: 'DOTS',
  motion: 'STILL',
};
const name = 'تم زمستان';
const latest = {
  name,
  version: 2,
  theme: { ...initial, accent: '#acdfeb' },
  description: 'آخرین نسخه',
  updatedAt: '2026-11-25T10:00:00Z',
  archivedAt: null,
};

function mockLibrary() {
  const save =
    vi.fn<
      (input: {
        name: string;
        theme: FestivalTheme;
        description: string | null;
        expectedVersion?: number;
      }) => void
    >();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        const input = JSON.parse(String(options.body)) as Parameters<typeof save>[0];
        save(input);
        return Response.json({
          ...latest,
          ...input,
          version: input.expectedVersion ? input.expectedVersion + 1 : 1,
        });
      }
      if (url.includes('/history?')) {
        return Response.json({
          template: latest,
          items: [
            {
              name,
              version: 1,
              theme: initial,
              description: 'نسخهٔ اولیه',
              createdAt: latest.updatedAt,
            },
          ],
          page: 1,
          hasMore: false,
        });
      }
      return Response.json({ presets: [], items: [latest], page: 1, hasMore: false });
    }),
  );
  return save;
}

afterEach(() => vi.unstubAllGlobals());

describe('FestivalThemeLibrary', () => {
  it('copies a historical theme as an independent theme', async () => {
    const save = mockLibrary();
    render(<FestivalThemeLibrary canWrite />);
    fireEvent.click(await screen.findByRole('button', { name: `نسخه‌های ${name}` }));
    fireEvent.click(await screen.findByRole('button', { name: 'مشاهده نسخهٔ ۱' }));
    fireEvent.click(screen.getByRole('button', { name: 'تکثیر تم' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'نام تم' }), {
      target: { value: 'تم مستقل' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ تم' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        name: 'تم مستقل',
        description: 'نسخهٔ اولیه',
        theme: initial,
      }),
    );
  });

  it('uses the latest revision as the concurrency check when editing an older revision', async () => {
    const save = mockLibrary();
    render(<FestivalThemeLibrary canWrite />);
    fireEvent.click(await screen.findByRole('button', { name: `نسخه‌های ${name}` }));
    fireEvent.click(await screen.findByRole('button', { name: 'مشاهده نسخهٔ ۱' }));
    fireEvent.click(screen.getByRole('button', { name: 'ساخت نسخهٔ جدید' }));
    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ نسخهٔ جدید' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        name,
        description: 'نسخهٔ اولیه',
        theme: initial,
        expectedVersion: 2,
      }),
    );
  });
});
