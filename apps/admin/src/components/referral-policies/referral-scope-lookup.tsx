'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';

type Scope = { id: string; name: string };

export function ReferralScopeLookup() {
  const [entries, setEntries] = useState<Scope[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams({
      kind: String(form.get('kind')),
      q: String(form.get('q')).trim(),
    });
    setBusy(true);
    setEntries(null);
    setCopied('');
    setError('');
    try {
      const response = await fetch(`/api/referral-reward-policies/scopes?${query}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Lookup failed');
      setEntries((await response.json()) as Scope[]);
    } catch {
      setError('جست‌وجو انجام نشد. دوباره تلاش کنید.');
    } finally {
      setBusy(false);
    }
  }

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setError('');
      setCopied(id);
    } catch {
      setError('کپی خودکار انجام نشد. شناسه را انتخاب و کپی کنید.');
    }
  }

  return (
    <details className="space-y-3 rounded border border-[var(--admin-color-border)] p-4">
      <summary className="cursor-pointer font-bold">یافتن شناسهٔ دسته یا کمپین</summary>
      <form onSubmit={(event) => void lookup(event)} className="flex flex-wrap items-end gap-3">
        <FormField id="referral-scope-kind" label="نوع">
          {(props) => (
            <select
              {...props}
              name="kind"
              className="min-h-10 rounded border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-3 text-sm"
            >
              <option value="category">دسته</option>
              <option value="campaign">کمپین</option>
            </select>
          )}
        </FormField>
        <FormField id="referral-scope-query" label="نام یا نامک" required>
          {(props) => <Input {...props} name="q" required maxLength={80} />}
        </FormField>
        <Button type="submit" loading={busy} variant="outline">
          جست‌وجو
        </Button>
      </form>
      {error && <Alert tone="danger">{error}</Alert>}
      {copied && (
        <p role="status" className="text-sm">
          شناسه کپی شد.
        </p>
      )}
      {entries &&
        (entries.length ? (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span>{entry.name}</span>
                <bdi className="break-all text-xs">{entry.id}</bdi>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`کپی شناسهٔ ${entry.name}`}
                  onClick={() => void copy(entry.id)}
                >
                  کپی شناسه
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">موردی یافت نشد.</p>
        ))}
    </details>
  );
}
