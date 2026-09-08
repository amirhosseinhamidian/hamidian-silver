import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContentPagesView } from '@/components/content-pages/content-pages-view';
import { CONTENT_PAGE_KEYS, type AdminContentPage } from '@/lib/content-pages/content-pages-model';

function page(key: AdminContentPage['key']): AdminContentPage {
  return {
    key,
    title: `عنوان ${key}`,
    eyebrow: null,
    subtitle: null,
    body: null,
    heroMediaId: ['ABOUT', 'CONTACT', 'SERVICES'].includes(key)
      ? '10000000-0000-4000-8000-000000000001'
      : null,
    heroMedia: ['ABOUT', 'CONTACT', 'SERVICES'].includes(key)
      ? { url: '/hero.jpg', altText: 'Hero', width: 1200, height: 500 }
      : null,
    sections: [],
    seoTitle: null,
    seoDescription: null,
    updatedByUserId: null,
    updatedAt: null,
  };
}

const pages = CONTENT_PAGE_KEYS.map(page);

afterEach(() => vi.restoreAllMocks());

describe('content pages view', () => {
  it('keeps all controls read-only without cms.write', () => {
    render(<ContentPagesView pages={pages} failed={false} canWrite={false} />);

    expect(screen.getByText(/دسترسی شما فقط برای مشاهده است/)).toBeInTheDocument();
    expect(screen.getByLabelText(/عنوان صفحه/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: /ذخیره محتوای/ })).not.toBeInTheDocument();
  });

  it('saves a normalized page through the BFF', async () => {
    const updated = { ...page('ABOUT'), title: 'عنوان تازه' };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    render(<ContentPagesView pages={pages} failed={false} canWrite />);

    fireEvent.change(screen.getByLabelText(/عنوان صفحه/), { target: { value: ' عنوان تازه ' } });
    fireEvent.click(screen.getByRole('button', { name: /ذخیره محتوای/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/content-pages/ABOUT',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(await screen.findByText(/ذخیره شد/)).toBeInTheDocument();
  });
});
