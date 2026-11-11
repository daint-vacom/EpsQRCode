/**
 * Scaffolded by table-builder from `src/project/material-safety-inspections/table/safety-inspection-list.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import { MaterialIdentity } from '@/components/material-identity';
import type { SafetyInspectionListRow } from '../model/safety-inspection';

export const SAFETY_INSPECTION_LIST_ROW_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export interface UseSafetyInspectionListColumnsParams {
  onView: (row: SafetyInspectionListRow) => void;
}

export function useSafetyInspectionListColumns(
  params: UseSafetyInspectionListColumnsParams,
): ColumnDef<SafetyInspectionListRow>[] {
  const intl = useIntl();
  const { onView } = params;

  return useMemo(() => {
    const col = createColumnHelpers<SafetyInspectionListRow>();

    return [
      col.custom({
        id: 'inspectedAt',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.list.inspectedAt',
        }),
        size: 190,
        enableSorting: false,
        cell: (row) => (
          <span className="text-sm text-foreground">
            {new Intl.DateTimeFormat(intl.locale, {
              dateStyle: 'medium',
            }).format(new Date(row.inspectedAt))}
          </span>
        ),
      }),
      col.custom({
        id: 'material',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.list.material',
        }),
        headerClassName: 'min-w-[250px]',
        size: 310,
        enableSorting: false,
        cell: (row) => (
          <MaterialIdentity name={row.materialName} code={row.materialCode} />
        ),
      }),
      col.text({
        id: 'inspectorName',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.list.inspector',
        }),
        get: (row) => row.inspectorName,
        size: 220,
        enableSorting: false,
      }),
      col.custom({
        id: 'result',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.list.result',
        }),
        size: 180,
        enableSorting: false,
        cell: (row) => (
          <Badge
            variant={
              row.status === 'in_progress'
                ? 'warning'
                : row.overallResult === 'passed'
                  ? 'success'
                  : 'destructive'
            }
          >
            {intl.formatMessage({
              id:
                row.status === 'in_progress'
                  ? 'project.materials.safetyInspection.status.inProgress'
                  : `project.materials.safetyInspection.results.${row.overallResult}`,
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
              action="view"
              tooltip="Xem"
              aria-label="Xem"
              type="button"
              mode="icon"
              size="sm"
              onClick={() => onView(row)}
            >
              <Eye className="size-4" />
            </DataGridActionButton>
          </div>
        ),
      }),
    ];
  }, [intl, onView]);
}
