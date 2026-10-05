import type { StatusBadgeConfig } from '@/components/ui/data-grid-columns';
import type { CustomerStatus } from '../model/customer';

export const CUSTOMER_STATUS_BADGE_CONFIG: StatusBadgeConfig<CustomerStatus> = {
  active: {
    label: 'Đang hoạt động',
    className:
      'h-auto min-h-0 min-w-0 rounded-none border-0 bg-transparent px-0 py-0 text-sm font-normal text-foreground shadow-none',
    dotClassName: 'bg-admin-success-dot opacity-100',
  },
  inactive: {
    label: 'Ngừng hoạt động',
    className:
      'h-auto min-h-0 min-w-0 rounded-none border-0 bg-transparent px-0 py-0 text-sm font-normal text-foreground shadow-none',
    dotClassName: 'bg-admin-red-primary opacity-100',
  },
  uncontacted: {
    label: 'Chưa liên hệ',
    className:
      'h-auto min-h-0 min-w-0 rounded-none border-0 bg-transparent px-0 py-0 text-sm font-normal text-foreground shadow-none',
    dotClassName: 'bg-admin-neutral-400 opacity-100',
  },
};
