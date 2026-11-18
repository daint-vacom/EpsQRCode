import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';

export function MaterialConditionBadge({ value }: { value: string | null }) {
  const intl = useIntl();
  if (value !== 'good' && value !== 'damaged') return value ?? '—';

  return (
    <Badge variant={value === 'damaged' ? 'destructive' : 'success'}>
      {intl.formatMessage({ id: `project.materials.condition.${value}` })}
    </Badge>
  );
}

export function MaterialStatusBadge({ value }: { value: string | null }) {
  const intl = useIntl();
  if (value !== 'available' && value !== 'loaned') return value ?? '—';

  return (
    <Badge variant={value === 'loaned' ? 'secondary' : 'outline'}>
      {intl.formatMessage({ id: `project.materials.status.${value}` })}
    </Badge>
  );
}

export function MaterialAvailabilityBadge({
  value,
}: {
  value: boolean | null;
}) {
  const intl = useIntl();
  if (value === null) return '—';

  return (
    <Badge
      variant={value ? 'success' : 'secondary'}
      appearance="light"
      size="sm"
    >
      {intl.formatMessage({
        id: value
          ? 'project.materialQrTracking.qrDialog.active'
          : 'project.materialQrTracking.qrDialog.inactive',
      })}
    </Badge>
  );
}
