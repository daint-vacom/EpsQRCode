import { Link } from 'react-router-dom';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { useLayout } from './context';

export function SidebarHeader({ collapsed = false }: { collapsed?: boolean }) {
  const { shell } = useLayout();
  const isDark = shell.secondarySidebarVariant === 'dark';

  return (
    <Link
      to={shell.homePath}
      className={cn(
        'flex shrink-0 items-center justify-center border-b transition-colors duration-200',
        collapsed
          ? 'h-(--header-height-mobile) px-0 lg:h-(--header-height)'
          : 'h-20 px-3',
        isDark
          ? 'border-admin-shell-border/80 bg-admin-shell-deep'
          : 'border-border bg-card',
      )}
      aria-label="Trang chủ EPS GENCO 3"
    >
      <img
        src={toAbsoluteUrl(
          collapsed
            ? '/media/logos/evn-genco3-no-text.png'
            : '/media/logos/evn-genco3-vertical.webp',
        )}
        alt=""
        className={
          collapsed ? 'size-9 object-contain' : 'h-20 w-full object-contain'
        }
      />
    </Link>
  );
}
