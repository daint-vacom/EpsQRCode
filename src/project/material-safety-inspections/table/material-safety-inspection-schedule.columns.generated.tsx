/**
 * Scaffolded by table-builder from `src/project/material-safety-inspections/table/material-safety-inspection-schedule.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useIntl } from 'react-intl';
import { createColumnHelpers } from '@/components/ui/data-grid-columns';
import {
  formatSafetyInspectionInterval,
  formatSafetyInspectionSource,
  SafetyInspectionDueDate,
  SafetyInspectionRowAction,
  SafetyInspectionStatusBadge,
} from '../components/safety-inspection-schedule-cells';
import type { MaterialSafetyInspectionType } from '../model/safety-inspection';

export function useMaterialSafetyInspectionScheduleColumns(
  materialId: string,
  canManage: boolean,
  returnTo: string,
): ColumnDef<MaterialSafetyInspectionType>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialSafetyInspectionType>();

    return [
      col.text({
        id: 'typeName',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.type',
        }),
        get: (row) => row.typeName,
        size: 220,
        enableSorting: false,
      }),
      col.custom({
        id: 'interval',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.schedule.interval',
        }),
        size: 135,
        enableSorting: false,
        cell: (row) =>
          formatSafetyInspectionInterval(
            intl,
            row.intervalValue,
            row.intervalUnit,
          ),
      }),
      col.custom({
        id: 'source',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.schedule.source',
        }),
        size: 155,
        enableSorting: false,
        cell: (row) => formatSafetyInspectionSource(intl, row.sourceKind),
      }),
      col.custom({
        id: 'dueDate',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.nextDue',
        }),
        size: 175,
        enableSorting: false,
        cell: (row) =>
          row.dueDate && row.daysRemaining !== null ? (
            <SafetyInspectionDueDate
              dueDate={row.dueDate}
              daysRemaining={row.daysRemaining}
            />
          ) : (
            '—'
          ),
      }),
      col.custom({
        id: 'status',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.status',
        }),
        size: 160,
        enableSorting: false,
        cell: (row) =>
          row.status ? (
            <SafetyInspectionStatusBadge status={row.status} />
          ) : row.enabled ? (
            '—'
          ) : (
            intl.formatMessage({
              id: 'project.materials.safetyInspection.schedule.disabled',
            })
          ),
      }),
      col.custom({
        id: 'start',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.action',
        }),
        cellClassName: 'text-right',
        size: 180,
        enableSorting: false,
        cell: (row) =>
          (row.enabled || row.activeInspectionId) && canManage ? (
            <SafetyInspectionRowAction
              materialId={materialId}
              typeId={row.typeId}
              activeInspectionId={row.activeInspectionId}
              hasChecklist={row.checklist.length > 0}
              canManage={canManage}
              returnTo={returnTo}
            />
          ) : null,
      }),
    ];
  }, [canManage, intl, materialId, returnTo]);
}
