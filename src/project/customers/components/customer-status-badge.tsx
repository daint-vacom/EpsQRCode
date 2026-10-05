import { CUSTOMER_STATUS_LABELS, type CustomerStatus } from '../model/customer';

const CUSTOMER_STATUS_DOT_CLASSES: Record<CustomerStatus, string> = {
  active: 'bg-admin-success-dot',
  inactive: 'bg-admin-red-primary',
  uncontacted: 'bg-admin-neutral-400',
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-normal text-foreground">
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${CUSTOMER_STATUS_DOT_CLASSES[status]}`}
      />
      {CUSTOMER_STATUS_LABELS[status]}
    </span>
  );
}
