import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useLayout } from './context';

export function SidebarHeader() {
  const { shell } = useLayout();
  const isDark = shell.secondarySidebarVariant === 'dark';
  const brand = shell.sidebarBrand ?? {
    name: 'VACOM',
    subtitle: 'KẾ TOÁN DỊCH VỤ',
  };

  return (
    <Link
      to={shell.homePath}
      className={cn(
        'flex h-(--header-height-mobile) shrink-0 items-center border-b px-4 lg:h-(--header-height)',
        isDark
          ? 'border-admin-shell-border/80 bg-admin-shell-deep'
          : 'border-border bg-card',
      )}
    >
      <span className="min-w-0 leading-[0.9]">
        <span className="block bg-gradient-to-r from-red-600 via-rose-500 to-red-800 bg-clip-text font-admin-display text-[1.65rem] font-black uppercase tracking-[0.06em] text-transparent">
          {brand.name}
        </span>
        <span
          className={cn(
            'mt-1 block whitespace-nowrap font-admin-display text-[0.72rem] font-bold uppercase tracking-[0.1em]',
            isDark ? 'text-white/70' : 'text-foreground',
          )}
        >
          {brand.subtitle}
        </span>
      </span>
    </Link>
  );
}
