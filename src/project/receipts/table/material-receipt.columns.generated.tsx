/**
 * Scaffolded by table-builder from `src/project/receipts/table/material-receipt.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
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
import type { MaterialReceipt } from '../model/material-receipt';

export const MATERIAL_RECEIPT_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export function useMaterialReceiptColumns(params: {
  onView: (receipt: MaterialReceipt) => void;
}): ColumnDef<MaterialReceipt>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialReceipt>();

    return [
      col.custom({
        id: 'receipt',
        header: intl.formatMessage({ id: 'receipts.columns.receipt' }),
        size: 250,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{row.code}</span>
            <span className="truncate text-xs text-muted-foreground">
              {row.totalItems} vật tư
            </span>
          </div>
        ),
      }),
      col.custom({
        id: 'warehouse',
        header: intl.formatMessage({ id: 'receipts.columns.warehouse' }),
        size: 220,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">
              {row.warehouse.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {row.warehouse.code}
            </span>
          </div>
        ),
      }),
      col.date({
        id: 'createdAt',
        header: intl.formatMessage({ id: 'receipts.columns.createdAt' }),
        get: (row) => row.createdAt,
        mode: 'date',
        size: 220,
        enableSorting: false,
      }),
      col.custom({
        id: 'progress',
        header: intl.formatMessage({ id: 'receipts.columns.progress' }),
        size: 170,
        enableSorting: false,
        cell: (row) => {
          const percent = row.totalItems
            ? Math.floor((row.receivedItems / row.totalItems) * 100)
            : 0;
          return (
            <div className="min-w-32">
              <div className="mb-1 flex justify-between text-xs">
                <span>
                  {row.receivedItems} / {row.totalItems}
                </span>
                <span>{percent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        },
      }),
      col.custom({
        id: 'status',
        header: intl.formatMessage({ id: 'receipts.fields.status' }),
        size: 140,
        enableSorting: false,
        cell: (row) => (
          <Badge
            variant={
              row.status === 'completed'
                ? 'success'
                : row.status === 'cancelled'
                  ? 'secondary'
                  : row.status === 'handover'
                    ? 'info'
                    : 'outline'
            }
          >
            {intl.formatMessage({ id: `receipts.status.${row.status}` })}
          </Badge>
        ),
      }),
      col.actions({
        id: 'actions',
        header: '',
        cellClassName: 'text-right',
        size: getDataGridActionsColumnSize(1),
        enableSorting: false,
        cell: (row) => (
          <div className="flex justify-end">
            <DataGridActionButton
              action="view"
              tooltip={intl.formatMessage({ id: 'receipts.actions.view' })}
              aria-label={intl.formatMessage({ id: 'receipts.actions.view' })}
              type="button"
              mode="icon"
              size="sm"
              onClick={() => params.onView(row)}
            >
              <Eye className="size-4" />
            </DataGridActionButton>
          </div>
        ),
      }),
    ];
  }, [intl, params]);
}
