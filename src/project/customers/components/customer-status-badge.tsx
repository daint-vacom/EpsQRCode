import { StatusIndicator } from '@/components/common/status-indicator';
import { CUSTOMER_STATUS_LABELS, type CustomerStatus } from '../model/customer';

const CUSTOMER_STATUS_DOT_CLASSES: Record<CustomerStatus, string> = {
  active: 'bg-admin-success-dot',
  inactive: 'bg-admin-red-primary',
  uncontacted: 'bg-admin-neutral-400',
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <StatusIndicator
      label={CUSTOMER_STATUS_LABELS[status]}
      dotClassName={CUSTOMER_STATUS_DOT_CLASSES[status]}
    />
  );
}
