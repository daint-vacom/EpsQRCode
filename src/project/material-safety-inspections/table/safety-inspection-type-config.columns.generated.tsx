/**
 * Scaffolded by table-builder from `src/project/material-safety-inspections/table/safety-inspection-type-config.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import { useIntl } from 'react-intl';
import { formatDate } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import {
  formatSafetyInspectionInterval,
  formatSafetyInspectionSource,
} from '../components/safety-inspection-schedule-cells';
import type { SafetyInspectionTypeConfigView } from '../model/safety-inspection-type-config';

export const SAFETY_INSPECTION_TYPE_CONFIG_VIEW_COLUMN_PINNING: ColumnPinningState =
  {
    right: ['actions'],
  };

export interface UseSafetyInspectionTypeConfigColumnsParams {
  onEdit?: (row: SafetyInspectionTypeConfigView) => void;
}

export function useSafetyInspectionTypeConfigColumns({
  onEdit,
}: UseSafetyInspectionTypeConfigColumnsParams): ColumnDef<SafetyInspectionTypeConfigView>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<SafetyInspectionTypeConfigView>();

    return [
      col.text({
        id: 'typeName',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.type',
        }),
        get: (row) => row.typeName,
        size: 210,
        enableSorting: false,
      }),
      col.custom({
        id: 'interval',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.schedule.interval',
        }),
        size: 125,
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
        size: 140,
        enableSorting: false,
        cell: (row) => formatSafetyInspectionSource(intl, row.sourceKind),
      }),
      col.custom({
        id: 'startsOn',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.typeConfig.startsOn',
        }),
        size: 175,
        enableSorting: false,
        cell: (row) =>
          row.startsOn ? formatDate(new Date(`${row.startsOn}T00:00:00`)) : '—',
      }),
      col.custom({
        id: 'enabled',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.status',
        }),
        size: 140,
        enableSorting: false,
        cell: (row) => (
          <Badge variant={row.enabled ? 'success' : 'secondary'}>
            {intl.formatMessage({
              id: row.enabled
                ? 'project.materials.safetyInspection.typeConfig.active'
                : 'project.materials.safetyInspection.typeConfig.inactive',
            })}
          </Badge>
        ),
      }),
      col.actions({
        header: '',
        size: getDataGridActionsColumnSize(1),
        enableSorting: false,
        cell: (row) => (
          <div className="flex justify-end gap-1">
            <DataGridActionButton
              action="edit"
              tooltip={intl.formatMessage({
                id: 'project.materials.safetyInspection.typeConfig.edit',
              })}
              aria-label={intl.formatMessage({
                id: 'project.materials.safetyInspection.typeConfig.edit',
              })}
              type="button"
              mode="icon"
              size="sm"
              onClick={() => onEdit?.(row)}
            >
              <Pencil className="size-4" />
            </DataGridActionButton>
          </div>
        ),
      }),
    ];
  }, [intl, onEdit]);
}
