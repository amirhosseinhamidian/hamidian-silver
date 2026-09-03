'use client';

import { createContext, useContext, useState } from 'react';

import { AuthModal } from './AuthModal';

interface AuthModalContextValue {
  openAuthModal(): void;

  closeAuthModal(): void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <AuthModalContext.Provider
      value={{
        openAuthModal() {
          setOpen(true);
        },

        closeAuthModal() {
          setOpen(false);
        },
      }}
    >
      {children}

      <AuthModal open={open} onClose={() => setOpen(false)} />
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);

  if (!context) {
    throw new Error('useAuthModal must be used inside AuthModalProvider');
  }

  return context;
}
