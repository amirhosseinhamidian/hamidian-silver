import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FestivalDesigner } from './festival-designer';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock('@/lib/campaigns/campaign-selection', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/campaigns/campaign-selection')>()),
  useCampaignTaxonomy: () => ({ data: { categories: [], brands: [] } }),
}));

afterEach(() => vi.unstubAllGlobals());

it('adds, reorders and removes sections while preserving the complete product list', async () => {
  const save = vi.fn(async (_url: string, _request: RequestInit) => Response.json({}));
  vi.stubGlobal('fetch', save);
  render(
    <FestivalDesigner
      campaignId="festival"
      editable
      editor={{
        revision: 3,
        design: null,
        history: [],
        media: [],
        presets: [
          {
            name: 'پیش‌فرض',
            theme: {
              background: '#18121e',
              surface: '#222230',
              foreground: '#fefefe',
              accent: '#ecacd5',
              decoration: 'NONE',
              motion: 'STILL',
            },
          },
        ],
      }}
    />,
  );

  fireEvent.click(screen.getByRole('combobox', { name: 'نوع بخش تازه' }));
  fireEvent.click(screen.getByRole('option', { name: 'مزیت‌های جشنواره' }));
  fireEvent.click(screen.getByRole('button', { name: 'افزودن بخش' }));
  const sections = within(screen.getByRole('list', { name: 'ترتیب بخش‌های جشنواره' }));
  const highlights = within(sections.getAllByRole('listitem').at(-1)!);
  fireEvent.change(highlights.getByLabelText('توضیح بخش'), {
    target: { value: 'راهنمای جشنواره' },
  });
  fireEvent.click(highlights.getByRole('checkbox', { name: 'استفاده از پس‌زمینهٔ دوم تم' }));
  fireEvent.click(highlights.getByRole('button', { name: 'بردن مزیت‌های جشنواره به بالا' }));
  fireEvent.click(sections.getByRole('button', { name: 'حذف بخش زمان باقی‌مانده' }));
  expect(sections.getByRole('checkbox', { name: 'همهٔ محصولات' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ نسخهٔ طرح' }));

  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(JSON.parse(String(save.mock.calls[0][1].body))).toMatchObject({
    sections: [
      { kind: 'HERO' },
      { kind: 'INTRO' },
      { kind: 'HIGHLIGHTS', description: 'راهنمای جشنواره', highlighted: true },
      { kind: 'PRODUCTS', enabled: true },
    ],
  });
});
