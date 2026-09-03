'use client';

import { useState } from 'react';

import { PhoneStep } from './PhoneStep';
import { OtpStep } from './OtpStep';

type AuthStep = 'phone' | 'otp';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');

  if (!open) {
    return null;
  }

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        flex
        items-center
        justify-center
        bg-black/40
        px-4
      "
    >
      <div
        className="
          w-full
          max-w-md
          rounded-(--luxury-radius-md)
          bg-white
          p-8
          text-black
        "
      >
        <div
          className="
            flex
            flex-col
            items-center
            text-center
          "
        >
          <img
            src="/logo.png"
            alt="گالری نقره حمیدیان"
            className="
              h-12
              w-12
              object-contain
            "
          />

          <h2
            className="
              mt-4
              text-sm
              font-medium
            "
          >
            گالری نقره حمیدیان
          </h2>

          <p
            className="
              mt-8
              text-lg
              font-medium
            "
          >
            ورود به حساب کاربری
          </p>
        </div>

        <div className="mt-8">
          {step === 'phone' ? (
            <PhoneStep
              onSuccess={(value) => {
                setPhone(value);
                setStep('otp');
              }}
            />
          ) : (
            <OtpStep phone={phone} onSuccess={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}
