import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CampaignLinkBuilder } from './campaign-link-builder';

const campaign = {
  campaignId: 'winter-1',
  campaign: 'winter',
  destination: '/products',
  medium: 'instagram',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

it('uses the bound identity, shows the resulting tags and links to their finance report', async () => {
  const url =
    'https://hamidian.shop/products?utm_source=instagram&utm_medium=instagram&utm_campaign=winter&utm_id=winter-1';
  const save = vi.fn(async (_path: string, _request: RequestInit) =>
    Response.json(
      { url, campaign: campaign.campaign, campaignId: campaign.campaignId },
      { status: 201 },
    ),
  );
  vi.stubGlobal('fetch', save);
  render(
    <CampaignLinkBuilder
      campaign={campaign}
      campaignName="کمپین زمستان"
      campaignStatus="پیش‌نویس"
      fixedDestination
      canReadReports
    />,
  );
  expect(screen.getByText('وضعیت کمپین پیش‌نویس')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'ساخت لینک' }));
  await waitFor(() => expect(screen.getByLabelText('لینک کمپین')).toHaveValue(url));
  expect(JSON.parse(String(save.mock.calls[0][1].body))).toMatchObject({
    ...campaign,
    source: 'instagram',
  });
  expect(screen.getByRole('link', { name: 'گزارش منبع و کانال' })).toHaveAttribute(
    'href',
    '/growth?campaignId=winter-1&source=instagram&medium=instagram',
  );
});

it('keeps inputs and displays the server rejection alongside the saved destination', async () => {
  const save = vi.fn(async () =>
    Response.json(
      {
        error: { message: 'Choose an available campaign destination.' },
      },
      { status: 400 },
    ),
  );
  vi.stubGlobal('fetch', save);
  render(<CampaignLinkBuilder campaign={campaign} fixedDestination />);
  fireEvent.click(screen.getByRole('button', { name: 'ساخت لینک' }));
  expect(
    await screen.findByText('مقصد انتخاب‌شده اکنون در فروشگاه در دسترس نیست.'),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('منبع', { exact: false })).toHaveValue('instagram');
  expect(screen.queryByRole('link', { name: 'گزارش منبع و کانال' })).toBeNull();
});
