export function DashboardHeader() {
  return (
    <header
      className="
        flex
        h-16
        items-center
        justify-between
        border-b
        border-(--ui-border)
        px-6
      "
    >
      <h1
        className="
          text-lg
          font-medium
        "
      >
        Hamidian Silver Admin
      </h1>

      <div>Admin</div>
    </header>
  );
}
