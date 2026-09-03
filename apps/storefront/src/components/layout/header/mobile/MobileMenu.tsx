const items = ['خانه', 'انگشتر', 'گردنبند', 'دستبند', 'گوشواره', 'برندها'];

interface MobileMenuProps {
  open: boolean;
}

export function MobileMenu({ open }: MobileMenuProps) {
  if (!open) return null;

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        bg-white
        p-6
      "
    >
      <nav
        className="
          flex
          flex-col
          gap-6
        "
      >
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </nav>
    </div>
  );
}
