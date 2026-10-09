import { Link } from 'react-router-dom';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { useLayout } from './context';

export function SidebarHeader() {
  const { shell } = useLayout();
  const isDark = shell.secondarySidebarVariant === 'dark';

  return (
    <Link
      to={shell.homePath}
      className={cn(
        'flex h-20 shrink-0 items-center justify-center border-b px-3 transition-colors duration-300',
        isDark
          ? 'border-admin-shell-border/80 bg-admin-shell-deep'
          : 'border-border bg-card',
      )}
      aria-label="Trang chủ EPS GENCO 3"
    >
      <img
        src={toAbsoluteUrl('/media/logos/evn-genco3-vertical.webp')}
        alt="EVN GENCO 3 — Cùng nỗ lực đưa các nhà máy điện"
        className="h-20 w-full object-contain"
      />
    </Link>
  );
}
