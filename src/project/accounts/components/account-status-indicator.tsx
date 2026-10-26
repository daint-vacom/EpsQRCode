import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import type { QrCodeAccountStatus } from '../model/account';

const ACCOUNT_STATUS_DOT_CLASSES: Record<QrCodeAccountStatus, string> = {
  active: 'bg-admin-success-dot',
  suspended: 'bg-admin-amber-primary',
  deactivated: 'bg-admin-red-primary',
};

export function AccountStatusIndicator({
  status,
}: {
  status: QrCodeAccountStatus;
}) {
  const intl = useIntl();

  return (
    <span
      role="img"
      aria-label={intl.formatMessage({ id: `accounts.status.${status}` })}
      className={cn(
        'inline-block size-2 rounded-full',
        ACCOUNT_STATUS_DOT_CLASSES[status],
      )}
    />
  );
}
