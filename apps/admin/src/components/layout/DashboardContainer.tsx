interface DashboardContainerProps {
  children: React.ReactNode;
}

export function DashboardContainer({ children }: DashboardContainerProps) {
  return (
    <main
      className="
        flex-1
        p-6
      "
    >
      {children}
    </main>
  );
}
