/**
 * Scaffolded by table-builder from `src/project/receipts/table/material-receipt-item.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import { createColumnHelpers } from '@/components/ui/data-grid-columns';
import type { MaterialReceiptItemRow } from '../model/material-receipt';

export function useMaterialReceiptItemRowColumns(): ColumnDef<MaterialReceiptItemRow>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialReceiptItemRow>();

    return [
      col.custom({
        id: 'material',
        header: intl.formatMessage({ id: 'receipts.items.columns.material' }),
        size: 240,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {row.materialCode ?? '—'}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {row.materialName ?? ''}
            </span>
          </div>
        ),
      }),
      col.custom({
        id: 'model',
        header: intl.formatMessage({ id: 'receipts.items.columns.model' }),
        size: 220,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{row.modelName ?? '—'}</span>
            <span className="truncate text-xs text-muted-foreground">
              {row.modelCode ?? ''}
            </span>
          </div>
        ),
      }),
      col.text({
        id: 'serialNumber',
        header: intl.formatMessage({
          id: 'receipts.items.columns.serialNumber',
        }),
        get: (row) => row.serialNumber,
        size: 220,
        enableSorting: false,
      }),
      col.custom({
        id: 'condition',
        header: intl.formatMessage({ id: 'receipts.items.columns.condition' }),
        size: 160,
        enableSorting: false,
        cell: (row) => (
          <Badge variant={row.condition === 'damaged' ? 'warning' : 'success'}>
            {intl.formatMessage({
              id: `project.handover.condition.${row.condition}`,
            })}
          </Badge>
        ),
      }),
      col.custom({
        id: 'receiptOutcome',
        header: intl.formatMessage({
          id: 'receipts.items.columns.receiptOutcome',
        }),
        size: 160,
        enableSorting: false,
        cell: (row) => (
          <Badge
            variant={
              row.receiverOutcome === 'received'
                ? 'success'
                : row.receiverOutcome === 'not_received'
                  ? 'destructive'
                  : 'outline'
            }
          >
            {intl.formatMessage({
              id: `project.handover.receiptOutcome.${row.receiverOutcome}`,
            })}
          </Badge>
        ),
      }),
      col.text({
        id: 'note',
        header: intl.formatMessage({ id: 'receipts.items.columns.note' }),
        get: (row) => row.note,
        size: 280,
        enableSorting: false,
      }),
      col.custom({
        id: 'status',
        header: intl.formatMessage({ id: 'receipts.items.columns.status' }),
        size: 130,
        enableSorting: false,
        cell: (row) => (
          <Badge variant={row.status === 'active' ? 'outline' : 'secondary'}>
            {intl.formatMessage({ id: `receipts.items.status.${row.status}` })}
          </Badge>
        ),
      }),
    ];
  }, [intl]);
}
