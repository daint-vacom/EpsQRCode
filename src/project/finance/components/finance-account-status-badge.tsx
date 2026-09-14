import {
  StatusBadge,
  type StatusBadgeConfig,
} from '@/components/ui/data-grid-columns';

type FinanceAccountStatusKey = 'true' | 'false';

export const FINANCE_ACCOUNT_STATUS_BADGE_CONFIG: StatusBadgeConfig<FinanceAccountStatusKey> =
  {
    true: { label: 'Đang hoạt động', variant: 'success' },
    false: { label: 'Ngừng hoạt động', variant: 'outline' },
  };

export function FinanceAccountStatusBadge({
  isActive,
  size = 'md',
}: {
  isActive: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <StatusBadge
      status={String(isActive) as FinanceAccountStatusKey}
      config={FINANCE_ACCOUNT_STATUS_BADGE_CONFIG}
      size={size}
    />
  );
}
