import { StatusIndicator } from '@/components/common/status-indicator';

export function FinanceAccountStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <StatusIndicator
      label={isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
      dotClassName={isActive ? 'bg-admin-success-dot' : 'bg-admin-red-primary'}
    />
  );
}
