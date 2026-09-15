import type { ComponentPropsWithoutRef } from 'react';

import { Button } from '@/components/ui/button';

type IconButtonProps = Omit<ComponentPropsWithoutRef<typeof Button>, 'aria-label' | 'size'> & {
  label: string;
};

export function IconButton({ label, ...props }: IconButtonProps) {
  return <Button aria-label={label} size="icon" {...props} />;
}
