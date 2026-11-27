import { buildPath, ROUTES } from '@/constants/routes';
import { ClipboardCheck, ClipboardPenLine } from 'lucide-react';
import { useIntl, type IntlShape } from 'react-intl';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import { DataGridActionButton } from '@/components/ui/data-grid-columns';
import type { MaterialSafetyInspectionQueueRow } from '../model/safety-inspection';

export function formatSafetyInspectionInterval(
  intl: IntlShape,
  count: number | null,
  unit: 'day' | 'month' | 'quarter' | null,
): string {
  if (count === null || unit === null) return '—';
  return intl.formatMessage(
    { id: `project.materials.safetyInspection.schedule.interval.${unit}` },
    { count },
  );
}

export function formatSafetyInspectionSource(
  intl: IntlShape,
  kind: 'group' | 'model' | 'material',
): string {
  return intl.formatMessage({
    id: {
      group: 'project.materials.fields.group',
      model: 'project.materials.fields.model',
      material: 'project.materials.fields.identity',
    }[kind],
  });
}

export function SafetyInspectionDueDate({
  dueDate,
  daysRemaining,
}: {
  dueDate: string;
  daysRemaining: number;
}) {
  const intl = useIntl();
  return (
    <div className="space-y-1">
      <p className="text-sm text-foreground">
        {formatDate(new Date(`${dueDate}T00:00:00`))}
      </p>
      <p
        className={
          daysRemaining < 0
            ? 'text-xs font-medium text-destructive'
            : 'text-xs text-muted-foreground'
        }
      >
        {daysRemaining < 0
          ? intl.formatMessage(
              {
                id: 'project.materials.safetyInspection.queue.daysOverdue',
              },
              { days: Math.abs(daysRemaining) },
            )
          : daysRemaining === 0
            ? intl.formatMessage({
                id: 'project.materials.safetyInspection.queue.dueToday',
              })
            : intl.formatMessage(
                {
                  id: 'project.materials.safetyInspection.queue.daysRemaining',
                },
                { days: daysRemaining },
              )}
      </p>
    </div>
  );
}

export function SafetyInspectionStatusBadge({
  status,
}: {
  status: MaterialSafetyInspectionQueueRow['status'];
}) {
  const intl = useIntl();
  return (
    <Badge
      variant={
        status === 'due'
          ? 'destructive'
          : status === 'in_progress'
            ? 'warning'
            : 'success'
      }
    >
      {intl.formatMessage({
        id: `project.materials.safetyInspection.queue.status.${status === 'in_progress' ? 'inProgress' : status}`,
      })}
    </Badge>
  );
}

export function SafetyInspectionRowAction({
  materialId,
  typeId,
  activeInspectionId,
  hasChecklist,
  canManage,
  returnTo,
}: {
  materialId: string;
  typeId: string;
  activeInspectionId: string | null;
  hasChecklist: boolean;
  canManage: boolean;
  returnTo: string;
}) {
  const intl = useIntl();
  const inProgress = activeInspectionId !== null;
  const label = intl.formatMessage({
    id: inProgress
      ? 'project.materials.safetyInspection.actions.continue'
      : 'project.materials.safetyInspection.actions.createNow',
  });
  if ((!hasChecklist && !inProgress) || !canManage) {
    return (
      <DataGridActionButton
        action="primary"
        type="button"
        mode="link"
        size="sm"
        disabled
        title={intl.formatMessage({
          id: hasChecklist
            ? 'project.materials.safetyInspection.queue.noManage'
            : 'project.materials.safetyInspection.queue.noChecklist',
        })}
      >
        <ClipboardPenLine />
        {label}
      </DataGridActionButton>
    );
  }
  const path = inProgress
    ? buildPath(ROUTES.PROJECT.MATERIAL_SAFETY_INSPECTION_DETAIL, {
        id: materialId,
        inspectionId: activeInspectionId!,
      })
    : buildPath(ROUTES.PROJECT.MATERIAL_SAFETY_INSPECTION_CREATE, {
        id: materialId,
      });
  return (
    <DataGridActionButton action="primary" asChild mode="link" size="sm">
      <Link
        to={
          inProgress
            ? path
            : `${path}?inspectionTypeId=${encodeURIComponent(typeId)}`
        }
        state={{
          returnTo,
        }}
      >
        {inProgress ? <ClipboardCheck /> : <ClipboardPenLine />}
        {label}
      </Link>
    </DataGridActionButton>
  );
}
