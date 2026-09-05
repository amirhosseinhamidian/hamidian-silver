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

  it('replaces decrement with a remove action at the minimum quantity', () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();

    render(
      <QuantityControl value={1} min={1} max={3} onChange={onChange} onRemove={onRemove} />,
    );

    expect(screen.queryByRole('button', { name: 'کاهش تعداد' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'حذف از سبد خرید' }));

    expect(onRemove).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });
});
