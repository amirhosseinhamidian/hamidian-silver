import Link from 'next/link';

import { AdminIcon } from '@/components/layout/admin-icon';
import {
  isAdminNavigationItemActive,
  type AdminNavigationGroup,
} from '@/lib/navigation/admin-navigation';
import { cn } from '@/lib/ui/cn';

type AdminNavigationListProps = Readonly<{
  groups: readonly AdminNavigationGroup[];
  pathname: string;
  appearance?: 'dark' | 'light';
  onNavigate?: () => void;
}>;

export function AdminNavigationList({
  groups,
  pathname,
  appearance = 'light',
  onNavigate,
}: AdminNavigationListProps) {
  const dark = appearance === 'dark';

  return (
    <nav aria-label="ناوبری اصلی پنل" className="space-y-5">
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`admin-nav-${group.id}`}>
          <h2
            id={`admin-nav-${group.id}`}
            className={cn(
              'mb-1.5 px-3 text-[0.65rem] font-bold tracking-wide',
              dark ? 'text-slate-500' : 'text-[var(--admin-color-subtle)]',
            )}
          >
            {group.label}
          </h2>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isAdminNavigationItemActive(pathname, item.href);

              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    title={item.description}
                    onClick={onNavigate}
                    className={cn(
                      'group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold outline-none transition-colors focus-visible:shadow-[var(--admin-focus-ring)]',
                      dark && !active && 'text-slate-300 hover:bg-white/[0.07] hover:text-white',
                      dark && active && 'bg-blue-600 text-white shadow-sm',
                      !dark &&
                        !active &&
                        'text-[var(--admin-color-muted)] hover:bg-[var(--admin-color-surface-hover)] hover:text-[var(--admin-color-ink)]',
                      !dark &&
                        active &&
                        'bg-[var(--admin-color-primary-soft)] text-[var(--admin-color-primary)]',
                    )}
                  >
                    <AdminIcon
                      name={item.icon}
                      className={cn(
                        'shrink-0',
                        dark && !active && 'text-slate-500 group-hover:text-slate-300',
                        !dark && !active && 'text-[var(--admin-color-subtle)]',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {!dark ? (
                      <AdminIcon
                        name="chevron-left"
                        className="size-4 text-[var(--admin-color-subtle)]"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
