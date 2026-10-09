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
import type { MaterialGroup } from '../model/material-group';

export const MATERIAL_GROUP_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export interface UseMaterialGroupColumnsParams {
  onEdit: (row: MaterialGroup) => void;
  onDelete: (row: MaterialGroup) => void;
}

export function useMaterialGroupColumns(
  params: UseMaterialGroupColumnsParams,
): ColumnDef<MaterialGroup>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialGroup>();

    return [
      col.text({
        id: 'code',
        header: intl.formatMessage({ id: 'materialGroups.fields.code' }),
        get: (row) => row.code,
        size: 180,
        enableSorting: false,
      }),
      col.text({
        id: 'name',
        header: intl.formatMessage({ id: 'materialGroups.fields.name' }),
        get: (row) => row.name,
        size: 320,
        enableSorting: false,
      }),
      col.text({
        id: 'description',
        header: intl.formatMessage({ id: 'materialGroups.fields.description' }),
        get: (row) => row.description,
        size: 280,
        enableSorting: false,
      }),
      col.actions({
        id: 'actions',
        header: '',
        cellClassName: 'text-right',
        size: getDataGridActionsColumnSize(2),
        enableSorting: false,
        cell: (row) => (
          <div className="flex justify-end gap-1">
            <DataGridActionButton
              action="edit"
              tooltip="Sửa"
              aria-label="Sửa"
              type="button"
              mode="icon"
              size="sm"
              onClick={() => params.onEdit(row)}
            >
              <Pencil className="size-4" />
            </DataGridActionButton>
            <DataGridActionButton
              action="delete"
              tooltip="Xóa"
              aria-label="Xóa"
              type="button"
              mode="icon"
              size="sm"
              onClick={() => params.onDelete(row)}
            >
              <Trash2 className="size-4" />
            </DataGridActionButton>
          </div>
        ),
      }),
    ];
  }, [intl, params.onEdit, params.onDelete]);
}
