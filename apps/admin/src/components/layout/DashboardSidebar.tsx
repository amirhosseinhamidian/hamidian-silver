const menuItems = ['Dashboard', 'Products', 'Orders', 'Customers', 'Finance'];

export function DashboardSidebar() {
  return (
    <aside
      className="
        w-64
        border-l
        border-[var(--ui-border)]
        p-4
      "
    >
      <nav
        className="
          flex
          flex-col
          gap-3
        "
      >
        {menuItems.map((item) => (
          <div
            key={item}
            className="
              rounded-(--ui-radius)
              px-3
              py-2
            "
          >
            {item}
          </div>
        ))}
      </nav>
    </aside>
  );
}
