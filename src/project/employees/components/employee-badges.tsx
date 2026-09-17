import { X } from 'lucide-react';
import { Badge, BadgeButton } from '@/components/ui/badge';
import {
  StatusBadge,
  type StatusBadgeConfig,
} from '@/components/ui/data-grid-columns';
import type { EmployeeRole, EmployeeStatus } from '../model/employee';

export const EMPLOYEE_STATUS_BADGE_CONFIG: StatusBadgeConfig<EmployeeStatus> = {
  active: {
    label: 'Còn làm việc',
    variant: 'success',
    className: 'rounded-md px-2.5 py-1 text-xs',
  },
  inactive: {
    label: 'Ngừng làm việc',
    variant: 'destructive',
    className: 'rounded-md px-2.5 py-1 text-xs',
  },
};

export function EmployeeStatusBadge({
  status,
  size = 'md',
}: {
  status: EmployeeStatus;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <StatusBadge
      status={status}
      config={EMPLOYEE_STATUS_BADGE_CONFIG}
      size={size}
    />
  );
}

export const EMPLOYEE_ACCOUNT_BADGE_CONFIG: StatusBadgeConfig<string> = {
  true: {
    label: 'Đã liên kết',
    className:
      'rounded-md border-transparent bg-admin-success-bg px-2.5 py-1 text-xs text-admin-success-text',
    dotClassName: 'bg-admin-success-dot opacity-100',
  },
  false: {
    label: 'Chưa liên kết',
    variant: 'warning',
    className:
      'rounded-md border-transparent bg-admin-amber-bg px-2.5 py-1 text-xs text-admin-amber-dark',
    dotClassName: 'bg-admin-amber-primary opacity-100',
  },
};

export function EmployeeRoleBadge({
  role,
  onRemove,
}: {
  role: EmployeeRole;
  onRemove?: () => void;
}) {
  return (
    <Badge
      variant={role.color}
      appearance="light"
      className="max-w-full justify-start rounded-md px-2.5 py-1 text-xs"
    >
      <span className="min-w-0 truncate">{role.name}</span>
      {onRemove ? (
        <BadgeButton
          aria-label={`Bỏ ${role.name}`}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
        >
          <X />
        </BadgeButton>
      ) : null}
    </Badge>
  );
}

export function EmployeeAccountBadge({ linked }: { linked: boolean }) {
  return (
    <StatusBadge
      status={String(linked)}
      config={EMPLOYEE_ACCOUNT_BADGE_CONFIG}
    />
  );
}
