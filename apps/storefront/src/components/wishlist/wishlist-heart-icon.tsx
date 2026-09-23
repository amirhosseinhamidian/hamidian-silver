import { FiHeart } from 'react-icons/fi';

import { cn } from '@/lib/ui/cn';

type WishlistHeartIconProps = Readonly<{
  active: boolean;
  className?: string;
}>;

export function WishlistHeartIcon({ active, className }: WishlistHeartIconProps) {
  return (
    <span
      aria-hidden="true"
      data-active={active ? 'true' : 'false'}
      className={cn('sf-wishlist-heart', className)}
    >
      <span className="sf-wishlist-heart__ring" />
      <span className="sf-wishlist-heart__sparks" />
      <FiHeart
        className="sf-wishlist-heart__icon size-full"
        fill={active ? 'currentColor' : 'none'}
      />
    </span>
  );
}
