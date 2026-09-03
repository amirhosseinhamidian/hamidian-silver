'use client';

import { useState } from 'react';

import { requestOtp } from '@hamidian/api-client';

interface PhoneStepProps {
  onSuccess: (phone: string) => void;
}

export function PhoneStep({ onSuccess }: PhoneStepProps) {
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);

    try {
      await requestOtp({
        phone,
      });

      onSuccess(phone);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p
        className="
          text-center
          text-sm
          text-(--ui-muted)
        "
      >
        شماره موبایل خود را وارد کنید
      </p>

      <input
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="0912xxxxxxx"
        dir="ltr"
        className="
          mt-6
          w-full
          border
          border-(--ui-border)
          px-4
          py-3
          text-center
          outline-none
          rounded-(--luxury-radius-sm)
        "
      />

      <button
        disabled={loading}
        onClick={submit}
        className="
          mt-6
          w-full
          bg-black
          px-4
          py-3
          text-white
          rounded-(--luxury-radius-sm)
          transition
          hover:opacity-80
        "
      >
        {loading ? 'در حال ارسال...' : 'ادامه'}
      </button>
    </div>
  );
}
