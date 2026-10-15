import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from './card';
import { useDataGrid } from './data-grid';

export type DataGridHeaderVariant = 'title' | 'stats';

export interface DataGridHeaderProps {
  variant?: DataGridHeaderVariant;
  title?: ReactNode;
  description?: ReactNode;
  stats?: ReactNode;
  recordCountLabel?: ReactNode;
  toolbar?: ReactNode;
  secondaryRow?: ReactNode;
  className?: string;
}

/**
 * Shared table header preset for list pages. Keep the title variant available
 * for legacy tables while allowing newer pages to lead with filterable stats.
 */
export function DataGridHeader({
  variant = 'title',
  title,
  description,
  stats,
  recordCountLabel = 'dòng',
  toolbar,
  secondaryRow,
  className,
}: DataGridHeaderProps) {
  const { recordCount } = useDataGrid();
  const titleContent =
    variant === 'stats' ? null : (
      <CardHeading>
        {title ? <CardTitle>{title}</CardTitle> : null}
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeading>
    );

  return (
    <CardHeader
      className={cn(
        'pe-3 flex-col items-stretch',
        secondaryRow ? 'gap-2' : 'gap-4',
        className,
      )}
    >
      <div className="flex flex-col items-stretch gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-3">
          <span className="shrink-0 whitespace-nowrap text-sm font-medium text-foreground">
            {recordCount.toLocaleString('vi-VN')} {recordCountLabel}
          </span>
          {titleContent}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 xl:gap-3">
          {stats ? (
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {stats}
            </div>
          ) : null}
          {toolbar ? (
            <CardToolbar className="flex-wrap">{toolbar}</CardToolbar>
          ) : null}
        </div>
      </div>
      {secondaryRow ? <div className="w-full">{secondaryRow}</div> : null}
    </CardHeader>
  );
}
