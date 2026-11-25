import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addCampaignSelection,
  type CampaignProductOption,
} from '@/lib/campaigns/campaign-selection';
import { CampaignProductSearch } from './campaign-product-search';

function product(slug: string, name: string): CampaignProductOption {
  return {
    id: slug,
    slug,
    name,
    defaultPriceToman: 250_000,
    festivalPriceToman: null,
    quotaRemaining: null,
    availableQuantity: 2,
    categories: ['انگشتر'],
    imageUrl: null,
    imageAlt: null,
  };
}

function Picker() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <CampaignProductSearch
      selected={selected}
      max={2}
      onSelect={(slug) => setSelected((current) => addCampaignSelection(current, slug, 2))}
      onRemove={(slug) => setSelected((current) => current.filter((item) => item !== slug))}
    />
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('campaign product selection', () => {
  it('deduplicates picks and respects the field limit', () => {
    expect(addCampaignSelection(['ring'], 'ring', 2)).toEqual(['ring']);
    expect(addCampaignSelection(['ring', 'chain'], 'watch', 2)).toEqual(['ring', 'chain']);
  });

  it('keeps selected products after changing pages and supports removing either pick', async () => {
    const first = product('first', 'انگشتر اول');
    const second = product('second', 'انگشتر دوم');
    const renamed = { ...first, slug: 'first-renamed', name: 'انگشتر با اسلاگ تازه' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options?: RequestInit) => {
        if (options?.method === 'POST') {
          const { selected } = JSON.parse(String(options.body)) as { selected: string[] };
          return Response.json({
            items: [first, second].filter(({ slug }) => selected.includes(slug)),
            page: 1,
            hasMore: false,
          });
        }
        const page = Number(new URL(url, 'http://localhost').searchParams.get('page'));
        return Response.json({
          items: page === 1 ? [first] : [renamed, second],
          page,
          hasMore: page === 1,
        });
      }),
    );
    render(<Picker />);
    fireEvent.click(screen.getByRole('button', { name: 'جست‌وجوی محصولات' }));
    const firstButton = await screen.findByRole('button', { name: 'انتخاب انگشتر اول' });
    fireEvent.click(firstButton);
    expect(firstButton).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'صفحهٔ بعد' }));
    expect(
      await screen.findByRole('button', { name: 'انتخاب انگشتر با اسلاگ تازه' }),
    ).toBeDisabled();
    fireEvent.click(await screen.findByRole('button', { name: 'انتخاب انگشتر دوم' }));
    const selected = within(screen.getByRole('list', { name: 'محصولات انتخاب‌شده' }));
    const removeFirst = await selected.findByRole('button', { name: 'حذف انگشتر اول' });
    expect(selected.getByRole('button', { name: 'حذف انگشتر دوم' })).toBeInTheDocument();
    fireEvent.click(removeFirst);
    expect(selected.queryByRole('button', { name: 'حذف انگشتر اول' })).not.toBeInTheDocument();
    expect(await selected.findByRole('button', { name: 'حذف انگشتر دوم' })).toBeInTheDocument();
  });
});
