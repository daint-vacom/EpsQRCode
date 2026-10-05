import {
  StatusBadge,
  type StatusBadgeConfig,
} from '@/components/ui/data-grid-columns';
import { WORK_STATUS_LABELS, type WorkStatus } from '../model/work';

export const WORK_STATUS_BADGE_CONFIG: StatusBadgeConfig<WorkStatus> = {
  draft: {
    label: WORK_STATUS_LABELS.draft,
    variant: 'slate',
    className: 'rounded-md px-2.5 py-1 text-xs',
  },
  todo: {
    label: WORK_STATUS_LABELS.todo,
    variant: 'slate',
    className: 'rounded-md bg-admin-blue-muted px-2.5 py-1 text-xs',
  },
  in_progress: {
    label: WORK_STATUS_LABELS.in_progress,
    variant: 'blue',
    className: 'rounded-md px-2.5 py-1 text-xs',
  },
  paused: {
    label: WORK_STATUS_LABELS.paused,
    variant: 'amber',
    className: 'rounded-md px-2.5 py-1 text-xs',
  },
  completed: {
    label: WORK_STATUS_LABELS.completed,
    variant: 'green',
    className: 'rounded-md px-2.5 py-1 text-xs',
  },
  cancelled: {
    label: WORK_STATUS_LABELS.cancelled,
    variant: 'red',
    className: 'rounded-md px-2.5 py-1 text-xs',
  },
};

export function WorkStatusBadge({
  status,
  size = 'md',
}: {
  status: WorkStatus;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <StatusBadge
      status={status}
      config={WORK_STATUS_BADGE_CONFIG}
      size={size}
    />
  );
}
