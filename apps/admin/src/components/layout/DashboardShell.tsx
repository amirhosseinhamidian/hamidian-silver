import { DashboardHeader } from './DashboardHeader';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardContainer } from './DashboardContainer';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div
      className="
        flex
        min-h-screen
        bg-background
      "
    >
      <DashboardSidebar />

      <div className="flex flex-1 flex-col">
        <DashboardHeader />

        <DashboardContainer>{children}</DashboardContainer>
      </div>
    </div>
  );
}
