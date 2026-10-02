import type { ReactNode } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageBackButton } from '@/components/ui/page-back-button';

export type PageHeaderProps = {
  title: ReactNode;
  icon?: LucideIcon;
  titleAside?: ReactNode;
  actions?: ReactNode;
  showBackButton?: boolean;
  backLabel?: string;
  onBack?: () => void;
  className?: string;
};

function HistoryBackButton({ label }: { label: string }) {
  const navigate = useNavigate();

  return <PageBackButton label={label} onClick={() => navigate(-1)} />;
}

export function PageHeaderOverflowMenu({
  children,
  label = 'Thao tác khác',
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          mode="icon"
          size="icon"
          aria-label={label}
          title={label}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PageHeader({
  title,
  icon: Icon,
  titleAside,
  actions,
  showBackButton = false,
  backLabel = 'Quay lại',
  onBack,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {showBackButton ? (
          onBack ? (
            <PageBackButton label={backLabel} onClick={onBack} />
          ) : (
            <HistoryBackButton label={backLabel} />
          )
        ) : null}
        {Icon ? (
          <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        ) : null}
        <h1 className="shrink-0 text-lg font-semibold text-foreground">
          {title}
        </h1>
        {titleAside ? <div className="min-w-0 flex-1">{titleAside}</div> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
