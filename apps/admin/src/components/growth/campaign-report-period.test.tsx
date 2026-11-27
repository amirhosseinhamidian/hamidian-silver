import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CampaignReportPeriod } from './campaign-report-period';

describe('CampaignReportPeriod', () => {
  it('rejects reversed and overlong ranges before navigating', () => {
    const reversed = render(
      <CampaignReportPeriod path="/growth/campaigns/festival" from="2026-03-02" to="2026-03-01" />,
    );
    expect(fireEvent.submit(reversed.container.querySelector('form')!)).toBe(false);
    expect(screen.getByRole('alert')).toHaveTextContent('حداکثر ۹۲ روز');
    reversed.unmount();

    const overlong = render(
      <CampaignReportPeriod path="/growth/campaigns/festival" from="2026-01-01" to="2026-04-03" />,
    );
    expect(fireEvent.submit(overlong.container.querySelector('form')!)).toBe(false);
  });

  it('accepts a same-day report and submits the original Gregorian keys', () => {
    const { container } = render(
      <CampaignReportPeriod path="/growth/campaigns/festival" from="۲۰۲۶-۰۳-۰۱" to="2026-03-01" />,
    );
    const form = container.querySelector('form')!;
    expect(fireEvent.submit(form)).toBe(true);
    expect(Object.fromEntries(new FormData(form))).toEqual({
      from: '2026-03-01',
      to: '2026-03-01',
    });
  });
});
