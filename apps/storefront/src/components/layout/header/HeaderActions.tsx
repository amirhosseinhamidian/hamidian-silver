import { Heart, UserRound, MapPin, ShoppingBag } from 'lucide-react';

const actions = [
  {
    icon: Heart,
    label: 'علاقه‌مندی‌ها',
  },
  {
    icon: UserRound,
    label: 'حساب کاربری',
  },
  {
    icon: MapPin,
    label: 'موقعیت',
  },
  {
    icon: ShoppingBag,
    label: 'سبد خرید',
  },
];

export function HeaderActions() {
  return (
    <div
      className="
        flex
        items-center
        gap-5
      "
    >
      {actions.map(({ icon: Icon, label }) => (
        <button
          key={label}
          aria-label={label}
          className="
              transition
              duration-300
              hover:opacity-60
            "
        >
          <Icon size={20} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}
