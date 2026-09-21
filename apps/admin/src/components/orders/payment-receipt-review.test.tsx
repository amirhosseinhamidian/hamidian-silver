import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PaymentReceiptReview } from '@/components/orders/payment-receipt-review';
import type { AdminPaymentAttempt } from '@/lib/orders/orders-model';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const attempt: AdminPaymentAttempt = {
  id: '40000000-0000-4000-8000-000000000001',
  provider: 'card_to_card',
  status: 'AWAITING_REVIEW',
  amountToman: 1_250_000,
  providerReference: null,
  failureCode: null,
  failureMessage: null,
  verifiedAt: null,
  receiptMimeType: 'image/jpeg',
  receiptOriginalName: 'receipt.jpg',
  receiptSizeBytes: 150_000,
  receiptUploadedAt: '2026-09-19T10:00:00.000Z',
  createdAt: '2026-09-19T10:00:00.000Z',
};

describe('PaymentReceiptReview', () => {
  it('requires a rejection reason and sends it to the receipt rejection endpoint', async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', request);

    render(<PaymentReceiptReview attempt={attempt} canConfirm />);

    fireEvent.click(screen.getByRole('button', { name: 'رد رسید' }));
    fireEvent.change(screen.getByLabelText('دلیل رد رسید'), {
      target: { value: 'تصویر رسید خوانا نیست.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تأیید رد رسید' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/api/payment-receipts/40000000-0000-4000-8000-000000000001',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'تصویر رسید خوانا نیست.' }),
        },
      );
    });
    expect(
      await screen.findByText('رسید رد شده و امکان ثبت رسید جدید برای مشتری باز است.'),
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
