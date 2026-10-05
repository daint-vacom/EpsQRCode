import { Tag } from '@/components/ui/tag';
import { StatusIndicator } from '@/components/common/status-indicator';
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUSES,
  CONTRACT_VERSION_STATUS_LABELS,
  CONTRACT_VERSION_STATUSES,
  type ContractCashflowDirection,
  type ContractStatus,
  type ContractVersionStatus,
} from '../model/contract';
import {
  CONTRACT_CHARGE_DISPLAY_STATUS_LABELS,
  CONTRACT_CHARGE_STATUS_LABELS,
  type ContractChargeDisplayStatus,
  type ContractChargeStatus,
} from '../model/receivable';

type ContractBadgeStatus =
  | ContractStatus
  | ContractVersionStatus
  | ContractChargeStatus
  | ContractChargeDisplayStatus
  | string;

const STATUS_COLORS: Record<string, string> = {
  projected: '#64748b',
  active: '#16a34a',
  effective: '#16a34a',
  scheduled: '#ca8a04',
  paid: '#16a34a',
  upcoming: '#2563eb',
  open: '#64748b',
  unpaid: '#dc2626',
  not_due: '#64748b',
  draft: '#64748b',
  superseded: '#64748b',
  partially_paid: '#ca8a04',
  overdue: '#d97706',
  suspended: '#d97706',
  voided: '#dc2626',
  cancelled: '#dc2626',
  terminated: '#64748b',
  expired: '#dc2626',
};

const CONTRACT_STATUS_INDICATOR_CONFIG: Record<
  ContractStatus | ContractVersionStatus,
  { label: string; dotClassName: string }
> = {
  draft: {
    label: 'Bản nháp',
    dotClassName: 'bg-admin-neutral-400',
  },
  active: {
    label: 'Đang hiệu lực',
    dotClassName: 'bg-admin-success-dot',
  },
  suspended: {
    label: 'Tạm dừng',
    dotClassName: 'bg-admin-amber-primary',
  },
  expired: {
    label: 'Hết hạn',
    dotClassName: 'bg-admin-red-primary',
  },
  terminated: {
    label: 'Đã chấm dứt',
    dotClassName: 'bg-admin-neutral-400',
  },
  scheduled: {
    label: CONTRACT_VERSION_STATUS_LABELS.scheduled,
    dotClassName: 'bg-admin-amber-primary',
  },
  effective: {
    label: CONTRACT_VERSION_STATUS_LABELS.effective,
    dotClassName: 'bg-admin-success-dot',
  },
  superseded: {
    label: CONTRACT_VERSION_STATUS_LABELS.superseded,
    dotClassName: 'bg-admin-neutral-400',
  },
  cancelled: {
    label: CONTRACT_VERSION_STATUS_LABELS.cancelled,
    dotClassName: 'bg-admin-red-primary',
  },
};

const STATUS_LABELS: Record<string, string> = {
  ...CONTRACT_STATUS_LABELS,
  ...CONTRACT_VERSION_STATUS_LABELS,
  ...CONTRACT_CHARGE_STATUS_LABELS,
  ...CONTRACT_CHARGE_DISPLAY_STATUS_LABELS,
};

const CASHFLOW_STATUS_LABELS: Record<
  ContractCashflowDirection,
  Partial<Record<ContractChargeDisplayStatus, string>>
> = {
  receivable: {
    projected: 'Dự kiến thu',
    upcoming: 'Sắp tới hạn thu',
    unpaid: 'Chưa thu',
    partially_paid: 'Đã thu một phần',
    not_due: 'Chưa tới hạn thu',
    paid: 'Đã thu',
    overdue: 'Chưa thu',
    voided: 'Đã hủy',
  },
  payable: {
    projected: 'Dự kiến trả',
    upcoming: 'Sắp tới hạn trả',
    unpaid: 'Chưa trả',
    partially_paid: 'Đã trả một phần',
    not_due: 'Chưa tới hạn trả',
    paid: 'Đã trả',
    overdue: 'Chưa trả',
    voided: 'Đã hủy',
  },
};

export interface ContractStatusBadgeProps {
  status: ContractBadgeStatus;
  size?: 'sm' | 'md' | 'lg';
  direction?: ContractCashflowDirection;
  showDot?: boolean;
  className?: string;
}

export function ContractStatusBadge({
  status,
  size = 'md',
  direction,
  showDot = false,
  className,
}: ContractStatusBadgeProps) {
  if (
    CONTRACT_STATUSES.includes(status as ContractStatus) ||
    CONTRACT_VERSION_STATUSES.includes(status as ContractVersionStatus)
  ) {
    return (
      <StatusIndicator
        label={
          CONTRACT_STATUS_INDICATOR_CONFIG[
            status as ContractStatus | ContractVersionStatus
          ].label
        }
        dotClassName={
          CONTRACT_STATUS_INDICATOR_CONFIG[
            status as ContractStatus | ContractVersionStatus
          ].dotClassName
        }
        className={className}
      />
    );
  }

  const directionLabel =
    direction &&
    CASHFLOW_STATUS_LABELS[direction][status as ContractChargeDisplayStatus];
  const colorStatus = direction && status === 'overdue' ? 'unpaid' : status;

  return (
    <Tag
      size={size}
      shape="circle"
      color={STATUS_COLORS[colorStatus] ?? '#64748b'}
      className={className}
    >
      {showDot && (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      {directionLabel ?? STATUS_LABELS[status] ?? status}
    </Tag>
  );
}
