import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DonutChart } from '@/components/ui/donut-chart';

describe('DonutChart', () => {
  it('renders an accessible localized summary and preserves zero states', () => {
    render(
      <DonutChart
        title="توزیع صف عملیات"
        segments={[
          { label: 'آماده', value: 4, color: 'green' },
          { label: 'مسدود', value: 3, color: 'orange' },
          { label: 'خارج از SLA', value: 1, color: 'red' },
          { label: 'نامعتبر', value: Number.NaN, color: 'gray' },
        ]}
      />,
    );

    expect(screen.getByRole('img', { name: 'توزیع صف عملیات؛ مجموع ۸' })).toBeInTheDocument();
    expect(screen.getByText('نامعتبر').closest('li')).toHaveTextContent('۰');
  });
});
