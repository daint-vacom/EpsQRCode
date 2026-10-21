/**
 * Scaffolded by table-builder from `src/project/warehouses/table/warehouse.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import type { Warehouse } from '../model/warehouse';

export const WAREHOUSE_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export function useWarehouseColumns(params: {
  canManage: boolean;
  accountNameById: ReadonlyMap<string, string>;
  onEdit: (warehouse: Warehouse) => void;
}): ColumnDef<Warehouse>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<Warehouse>();

    return [
      col.custom({
        id: 'warehouse',
        header: intl.formatMessage({ id: 'warehouses.columns.warehouse' }),
        size: 250,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{row.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {row.code}
            </span>
          </div>
        ),
      }),
      col.text({
        id: 'address',
        header: intl.formatMessage({ id: 'warehouses.fields.address' }),
        get: (row) => row.address,
        size: 280,
        enableSorting: false,
      }),
      col.custom({
        id: 'accounts',
        header: intl.formatMessage({ id: 'warehouses.fields.accounts' }),
        size: 240,
        enableSorting: false,
        cell: (row) => (
          <span className="text-sm">
            {row.accountUserIds
              .map((id) => params.accountNameById.get(id) ?? id)
              .join(', ') || '—'}
          </span>
        ),
      }),
      col.custom({
        id: 'availability',
        header: intl.formatMessage({ id: 'warehouses.fields.availability' }),
        size: 100,
        enableSorting: false,
        cell: (row) => (
          <Badge variant={row.isActive ? 'success' : 'secondary'}>
            {intl.formatMessage({
              id: row.isActive
                ? 'warehouses.status.active'
                : 'warehouses.status.inactive',
            })}
          </Badge>
        ),
      }),
      col.actions({
        id: 'actions',
        header: '',
        cellClassName: 'text-right',
        size: getDataGridActionsColumnSize(1),
        enableSorting: false,
        cell: (row) =>
          params.canManage ? (
            <div className="flex justify-end">
              <DataGridActionButton
                action="edit"
                tooltip={intl.formatMessage({ id: 'common.actions.edit' })}
                aria-label={intl.formatMessage({ id: 'common.actions.edit' })}
                type="button"
                mode="icon"
                size="sm"
                onClick={() => params.onEdit(row)}
              >
                <Pencil className="size-4" />
              </DataGridActionButton>
            </div>
          ) : null,
      }),
    ];
  }, [intl, params]);
}
