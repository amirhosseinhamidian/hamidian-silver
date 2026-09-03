'use client';

import { useState } from 'react';

import { verifyOtp } from '@hamidian/api-client';

import { useAuth } from '@/providers/AuthProvider';

interface OtpStepProps {
  phone: string;
  onSuccess: () => void;
}

export function OtpStep({ phone, onSuccess }: OtpStepProps) {
  const { login } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);

    try {
      const result = await verifyOtp({
        phone,
        code,
      });

      await login(result);

      onSuccess();
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
        کد ارسال شده را وارد کنید
      </p>

      <input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        maxLength={6}
        dir="ltr"
        className="
          mt-6
          w-full
          border
          border-(--ui-border)
          px-4
          py-3
          text-center
          tracking-[0.5em]
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
        {loading ? 'در حال بررسی...' : 'تایید'}
      </button>
    </div>
  );
}
