import { cn } from '@/lib/utils';
import { useLayout } from './context';
import { SidebarSecondary } from './sidebar-secondary';

export function Sidebar() {
  const { isSidebarOpen, shell } = useLayout();
  const isDark = shell.secondarySidebarVariant === 'dark';

  return (
    <aside
      className={cn(
        'fixed inset-y-0 start-0 z-20 flex w-(--sidebar-current-width) shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out',
        isDark
          ? 'border-e border-admin-shell-border/70 bg-admin-shell-deep'
          : 'border-e border-border bg-card',
      )}
    >
      {isSidebarOpen && <SidebarSecondary />}
    </aside>
  );
}
