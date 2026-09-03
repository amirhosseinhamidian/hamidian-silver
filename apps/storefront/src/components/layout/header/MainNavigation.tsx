const menuItems = [
  'خانه',
  'انگشتر',
  'گردنبند',
  'دستبند',
  'گوشواره',
  'دسته‌بندی',
  'برندها',
  'جدیدترین‌ها',
];

export function MainNavigation() {
  return (
    <nav
      className="
        hidden
        md:flex
        items-center
        justify-center
        gap-8
        border-t
        border-(--ui-border)
        py-4
        text-sm
      "
    >
      {menuItems.map((item) => (
        <span
          key={item}
          className="
            cursor-pointer
            transition
            duration-300
            hover:opacity-70
          "
        >
          {item}
        </span>
      ))}
    </nav>
  );
}
