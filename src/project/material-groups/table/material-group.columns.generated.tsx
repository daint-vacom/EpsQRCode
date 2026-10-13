/**
 * Scaffolded by table-builder from `src/project/material-groups/table/material-group.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import { Switch } from '@/components/ui/switch';
import type { MaterialGroup } from '../model/material-group';

export const MATERIAL_GROUP_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export interface UseMaterialGroupColumnsParams {
  onEdit: (row: MaterialGroup) => void;
  onDelete: (row: MaterialGroup) => void;
  canEdit: boolean;
  canDelete: boolean;
  canManage: boolean;
  onAvailabilityChange: (row: MaterialGroup, isActive: boolean) => void;
  pendingAvailabilityIds: ReadonlySet<string>;
}

export function useMaterialGroupColumns(
  params: UseMaterialGroupColumnsParams,
): ColumnDef<MaterialGroup>[] {
  const intl = useIntl();
  const {
    canEdit,
    canDelete,
    canManage,
    onEdit,
    onDelete,
    onAvailabilityChange,
    pendingAvailabilityIds,
  } = params;

  return useMemo(() => {
    const col = createColumnHelpers<MaterialGroup>();
    const actionCount = Number(canEdit) + Number(canDelete);

    const columns: ColumnDef<MaterialGroup>[] = [
      col.custom({
        id: 'availability',
        header: intl.formatMessage({
          id: 'materialGroups.fields.availability',
        }),
        size: 110,
        enableSorting: false,
        cell: (row) => (
          <div className="flex items-center justify-center">
            <Switch
              size="sm"
              checked={row.isActive}
              disabled={!canManage || pendingAvailabilityIds.has(row.id)}
              aria-label={`${row.isActive ? 'Tắt' : 'Bật'} sử dụng nhóm vật tư ${row.name}`}
              onCheckedChange={(checked) => onAvailabilityChange(row, checked)}
            />
          </div>
        ),
      }),
      col.custom({
        id: 'materialGroup',
        header: intl.formatMessage({ id: 'materialGroups.columns.group' }),
        size: 320,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">
              {row.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {row.code}
            </span>
          </div>
        ),
      }),
      col.text({
        id: 'description',
        header: intl.formatMessage({ id: 'materialGroups.fields.description' }),
        get: (row) => row.description,
        size: 280,
        enableSorting: false,
      }),
    ];

    if (actionCount > 0) {
      columns.push(
        col.actions({
          id: 'actions',
          header: '',
          cellClassName: 'text-right',
          size: getDataGridActionsColumnSize(actionCount),
          enableSorting: false,
          cell: (row) => (
            <div className="flex justify-end gap-1">
              {canEdit ? (
                <DataGridActionButton
                  action="edit"
                  tooltip="Sửa"
                  aria-label="Sửa"
                  type="button"
                  mode="icon"
                  size="sm"
                  onClick={() => onEdit(row)}
                >
                  <Pencil className="size-4" />
                </DataGridActionButton>
              ) : null}
              {canDelete ? (
                <DataGridActionButton
                  action="delete"
                  tooltip="Xóa"
                  aria-label="Xóa"
                  type="button"
                  mode="icon"
                  size="sm"
                  onClick={() => onDelete(row)}
                >
                  <Trash2 className="size-4" />
                </DataGridActionButton>
              ) : null}
            </div>
          ),
        }),
      );
    }

    return columns;
  }, [
    intl,
    canEdit,
    canDelete,
    canManage,
    onEdit,
    onDelete,
    onAvailabilityChange,
    pendingAvailabilityIds,
  ]);
}
