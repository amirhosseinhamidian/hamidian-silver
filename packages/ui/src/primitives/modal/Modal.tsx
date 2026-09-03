import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
}

export function Modal({ open, children, onClose }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="
        fixed
        inset-0
        flex
        items-center
        justify-center
        bg-black/30
      "
      onClick={onClose}
    >
      <div
        className="
          rounded-[var(--ui-radius)]
          bg-[var(--background)]
          p-6
        "
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
