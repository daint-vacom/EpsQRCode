import {
  RiArrowUpDoubleFill,
  RiArrowUpSFill,
  RiEqualFill,
  RiSubtractFill,
  type RemixiconComponentType,
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import { WORK_PRIORITY_LABELS, type WorkPriority } from '../model/work';

export const WORK_PRIORITY_ICON_CONFIG: Record<
  WorkPriority,
  { icon: RemixiconComponentType; className: string }
> = {
  low: { icon: RiSubtractFill, className: 'text-muted-foreground' },
  normal: { icon: RiEqualFill, className: 'text-admin-blue-primary' },
  high: { icon: RiArrowUpSFill, className: 'text-admin-amber-primary' },
  urgent: {
    icon: RiArrowUpDoubleFill,
    className: 'text-admin-red-primary',
  },
};

export function WorkPriorityIcon({
  priority,
  className,
}: {
  priority: WorkPriority;
  className?: string;
}) {
  const config = WORK_PRIORITY_ICON_CONFIG[priority];
  const Icon = config.icon;

  return (
    <Icon
      className={cn('!size-4 shrink-0', config.className, className)}
      aria-hidden="true"
      title={WORK_PRIORITY_LABELS[priority]}
    />
  );
}
