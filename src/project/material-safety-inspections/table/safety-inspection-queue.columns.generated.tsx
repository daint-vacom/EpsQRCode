/**
 * Scaffolded by table-builder from `src/project/material-safety-inspections/table/safety-inspection-queue.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import { ROUTES } from '@/constants/routes';
import { MaterialQrCode } from '@/project/materials/components/material-qr-code';
import type { ColumnDef } from '@tanstack/react-table';
import { useIntl } from 'react-intl';
import { formatDate } from '@/lib/date';
import { createColumnHelpers } from '@/components/ui/data-grid-columns';
import { MaterialIdentity } from '@/components/material-identity';
import {
  SafetyInspectionDueDate,
  SafetyInspectionRowAction,
  SafetyInspectionStatusBadge,
} from '../components/safety-inspection-schedule-cells';
import type { MaterialSafetyInspectionQueueRow } from '../model/safety-inspection';

export interface UseMaterialSafetyInspectionQueueColumnsParams {
  canManage: boolean;
}

export function useMaterialSafetyInspectionQueueColumns(
  params: UseMaterialSafetyInspectionQueueColumnsParams,
): ColumnDef<MaterialSafetyInspectionQueueRow>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialSafetyInspectionQueueRow>();

    return [
      col.custom({
        id: 'qrCode',
        header: intl.formatMessage({ id: 'project.materials.fields.qrCode' }),
        size: 90,
        enableSorting: false,
        cell: (row) => (
          <MaterialQrCode
            materialId={row.id}
            materialCode={row.code}
            size={40}
            className="mx-auto block"
          />
        ),
      }),
      col.custom({
        id: 'identity',
        header: intl.formatMessage({ id: 'project.materials.fields.identity' }),
        headerClassName: 'min-w-[260px]',
        size: 320,
        enableSorting: false,
        cell: (row) => <MaterialIdentity name={row.name} code={row.code} />,
      }),
      col.text({
        id: 'inspectionType',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.type',
        }),
        get: (row) => row.typeName,
        size: 200,
        enableSorting: false,
      }),
      col.custom({
        id: 'lastInspection',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.lastInspection',
        }),
        size: 170,
        enableSorting: false,
        cell: (row) =>
          row.lastInspectedAt ? (
            <span className="text-sm text-foreground">
              {formatDate(row.lastInspectedAt)}
            </span>
          ) : null,
      }),
      col.custom({
        id: 'nextDue',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.nextDue',
        }),
        size: 190,
        enableSorting: false,
        cell: (row) => (
          <SafetyInspectionDueDate
            dueDate={row.nextDueDate}
            daysRemaining={row.daysRemaining}
          />
        ),
      }),
      col.custom({
        id: 'status',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.status',
        }),
        size: 165,
        enableSorting: false,
        cell: (row) => <SafetyInspectionStatusBadge status={row.status} />,
      }),
      col.custom({
        id: 'startInspection',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.action',
        }),
        cellClassName: 'text-right',
        size: 210,
        enableSorting: false,
        cell: (row) => (
          <SafetyInspectionRowAction
            materialId={row.id}
            typeId={row.typeId}
            activeInspectionId={row.activeInspectionId}
            hasChecklist={row.hasChecklist}
            canManage={params.canManage}
            returnTo={ROUTES.PROJECT.MATERIALS_REQUIRING_INSPECTION}
          />
        ),
      }),
    ];
  }, [intl, params.canManage]);
}
