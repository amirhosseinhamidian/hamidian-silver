import { Menu, Search, ShoppingBag } from 'lucide-react';

import { Logo } from '../Logo';

export function MobileHeader() {
  return (
    <div
      className="
        flex
        h-16
        items-center
        justify-between
        md:hidden
      "
    >
      <button aria-label="menu">
        <Menu size={22} strokeWidth={1.5} />
      </button>

      <Logo />

      <div
        className="
          flex
          items-center
          gap-4
        "
      >
        <button aria-label="search">
          <Search size={20} strokeWidth={1.5} />
        </button>

        <button aria-label="cart">
          <ShoppingBag size={20} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
