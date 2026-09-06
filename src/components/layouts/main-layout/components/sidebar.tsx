import { cn } from '@/lib/utils';
import { useLayout } from './context';
import { SidebarPrimary } from './sidebar-primary';
import { SidebarSecondary } from './sidebar-secondary';

export function Sidebar() {
  const { isSidebarOpen, shell } = useLayout();
  const isDark = shell.secondarySidebarVariant === 'dark';

  return (
    <aside
      className={cn(
        'fixed inset-y-0 start-0 z-20 flex w-(--sidebar-current-width) shrink-0 overflow-hidden transition-[width] duration-200 ease-out',
        isDark
          ? 'border-e border-white/10 bg-admin-neutral-900'
          : 'border-e border-border bg-card',
      )}
    >
      <SidebarPrimary />
      {isSidebarOpen && <SidebarSecondary />}
    </aside>
  );
}
