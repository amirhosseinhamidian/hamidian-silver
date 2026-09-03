const items = ['جواهرات', 'مجموعه‌ها', 'درباره ما'];

export function Navigation() {
  return (
    <nav
      className="
        hidden
        md:flex
        items-center
        gap-8
        text-sm
      "
    >
      {items.map((item) => (
        <span
          key={item}
          className="
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
