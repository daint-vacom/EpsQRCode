import type { StatusBadgeConfig } from '@/components/ui/data-grid-columns';
import type { CustomerStatus } from '../model/customer';

export const CUSTOMER_STATUS_BADGE_CONFIG: StatusBadgeConfig<CustomerStatus> = {
  active: {
    label: 'Đang hoạt động',
    className:
      'rounded-md border-transparent bg-admin-success-bg px-2.5 py-1 text-xs text-admin-success-text',
    dotClassName: 'bg-admin-success-dot opacity-100',
  },
  inactive: {
    label: 'Ngừng hoạt động',
    className:
      'rounded-md border-transparent bg-admin-red-bg px-2.5 py-1 text-xs text-admin-red-dark',
    dotClassName: 'bg-admin-red-primary opacity-100',
  },
  uncontacted: {
    label: 'Chưa liên hệ',
    className:
      'rounded-md border-transparent bg-muted px-2.5 py-1 text-xs text-muted-foreground',
    dotClassName: 'bg-admin-neutral-400 opacity-100',
  },
};
