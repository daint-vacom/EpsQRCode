import { X } from 'lucide-react';
import { Badge, BadgeButton } from '@/components/ui/badge';
import { StatusIndicator } from '@/components/common/status-indicator';
import type { EmployeeRole, EmployeeStatus } from '../model/employee';

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return status === 'active' ? (
    <StatusIndicator label="Còn làm việc" dotClassName="bg-admin-success-dot" />
  ) : (
    <StatusIndicator
      label="Ngừng làm việc"
      dotClassName="bg-admin-red-primary"
    />
  );
}

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
    <StatusIndicator
      label={linked ? 'Đã liên kết' : 'Chưa liên kết'}
      dotClassName={linked ? 'bg-admin-success-dot' : 'bg-admin-amber-primary'}
    />
  );
}
