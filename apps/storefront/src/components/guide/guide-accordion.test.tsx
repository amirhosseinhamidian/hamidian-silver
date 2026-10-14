import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuideAccordion } from '@/components/guide/guide-accordion';

const items = [
  { question: 'پرسش اول', answer: 'پاسخ اول' },
  { question: 'پرسش دوم', answer: 'پاسخ دوم' },
];

describe('GuideAccordion', () => {
  it('animates a single open answer and closes the previous item', () => {
    render(<GuideAccordion items={items} />);

    const first = screen.getByRole('button', { name: 'پرسش اول' });
    const second = screen.getByRole('button', { name: 'پرسش دوم' });
    const firstPanel = document.getElementById(first.getAttribute('aria-controls') ?? '');
    const secondPanel = document.getElementById(second.getAttribute('aria-controls') ?? '');

    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(firstPanel).not.toBeNull();
    expect(firstPanel).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(firstPanel).toHaveAttribute('aria-hidden', 'false');
    expect(firstPanel).toHaveClass('grid-rows-[1fr]', 'opacity-100');

    fireEvent.click(second);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(firstPanel).toHaveAttribute('aria-hidden', 'true');
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(secondPanel).toHaveAttribute('aria-hidden', 'false');
  });
});
