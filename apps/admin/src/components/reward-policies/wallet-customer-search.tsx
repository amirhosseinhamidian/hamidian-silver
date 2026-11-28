'use client';

import type { components } from '@hamidian/contracts';
import { useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { walletOperationsPath } from '@/lib/reward-policies/wallet-operations';

type Customer = components['schemas']['WalletCustomerOptionDto'];

export function WalletCustomerSearch() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Customer[] | null>(null);
  const [error, setError] = useState('');

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const query = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    setResults(null);
    setError('');
    if (query.length < 2 || query.length > 80) {
      setError('برای جست‌وجو ۲ تا ۸۰ نویسه وارد کنید.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch('/api/reward-policies/customers/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query }),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Customer search failed');
      const result: unknown = await response.json();
      if (!Array.isArray(result)) throw new Error('Invalid customer search response');
      setResults(result as Customer[]);
    } catch {
      setError('جست‌وجوی حساب‌ها انجام نشد. دوباره تلاش کنید.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={(event) => void search(event)} className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <FormField id="wallet-customer" label="نام یا شمارهٔ موبایل مشتری" required>
            {(props) => (
              <Input
                {...props}
                name="q"
                minLength={2}
                maxLength={80}
                dir="auto"
                disabled={busy}
                required
              />
            )}
          </FormField>
        </div>
        <Button type="submit" loading={busy}>
          جست‌وجو
        </Button>
      </form>
      {error && <Alert tone="danger">{error}</Alert>}
      {results &&
        (results.length ? (
          <ul className="divide-y divide-[var(--admin-color-border)]">
            {results.map(({ id, firstName, lastName, phone }) => {
              const name = [firstName, lastName].filter(Boolean).join(' ');
              return (
                <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 text-sm">
                  <span>{name || 'نام ثبت نشده'}</span>
                  <bdi dir="ltr">{phone}</bdi>
                  <ButtonLink
                    href={`${walletOperationsPath}?${new URLSearchParams({ userId: id })}`}
                    className="ms-auto"
                    size="sm"
                    variant="outline"
                    aria-label={`نمایش کیف پول ${name || phone}`}
                  >
                    نمایش کیف پول
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
        ) : (
          <p role="status" className="text-sm">
            حسابی یافت نشد.
          </p>
        ))}
    </div>
  );
}
