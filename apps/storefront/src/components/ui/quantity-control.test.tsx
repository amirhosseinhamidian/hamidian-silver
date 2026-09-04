import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QuantityControl } from '@/components/ui/quantity-control';

describe('QuantityControl', () => {
  it('emits bounded quantity changes and disables controls at the boundaries', () => {
    const onChange = vi.fn();
    const { rerender } = render(<QuantityControl value={2} min={1} max={3} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'افزایش تعداد' }));
    expect(onChange).toHaveBeenLastCalledWith(3);

    fireEvent.click(screen.getByRole('button', { name: 'کاهش تعداد' }));
    expect(onChange).toHaveBeenLastCalledWith(1);

    rerender(<QuantityControl value={3} min={1} max={3} onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'افزایش تعداد' })).toBeDisabled();
  });
});
