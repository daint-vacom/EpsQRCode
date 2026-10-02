import { StatusBadge } from '@/components/ui/data-grid-columns';
import type { CustomerStatus } from '../model/customer';
import { CUSTOMER_STATUS_BADGE_CONFIG } from './customer-status-badge-config';

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return <StatusBadge status={status} config={CUSTOMER_STATUS_BADGE_CONFIG} />;
}
