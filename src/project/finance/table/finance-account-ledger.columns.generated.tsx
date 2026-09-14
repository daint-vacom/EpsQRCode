/**
 * Scaffolded by table-builder from `src/project/finance/table/finance-account-ledger.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { FinanceAccountLedgerTableRow } from '@/project/finance/model/finance-analytics';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import { formatFinanceAmount } from '../model/finance';

export const FINANCE_ACCOUNT_LEDGER_TABLE_ROW_COLUMN_PINNING: ColumnPinningState =
  {
    right: ['actions'],
  };

export interface UseFinanceAccountLedgerColumnsParams {
  onView: (row: FinanceAccountLedgerTableRow) => void;
}

export function useFinanceAccountLedgerColumns(
  params: UseFinanceAccountLedgerColumnsParams,
): ColumnDef<FinanceAccountLedgerTableRow>[] {
  const { onView } = params;
  return useMemo(() => {
    const col = createColumnHelpers<FinanceAccountLedgerTableRow>();

    return [
      col.date({
        id: 'effectiveDate',
        header: 'Ngày',
        get: (row) => row.effectiveDate,
        size: 150,
        enableSorting: false,
      }),
      col.custom({
        id: 'voucherNo',
        header: 'Số phiếu',
        size: 160,
        enableSorting: false,
        cell: (row) =>
          row.voucherId ? (
            <Link
              className="font-medium text-primary hover:underline"
              to={'/finance/vouchers/' + row.voucherId}
            >
              {row.voucherNo ?? 'Phiếu nháp'}
            </Link>
          ) : (
            (row.voucherNo ?? '—')
          ),
      }),
      col.text({
        id: 'description',
        header: 'Diễn giải',
        get: (row) => row.description,
        size: 280,
        enableSorting: false,
      }),
      col.text({
        id: 'categoryName',
        header: 'Khoản mục',
        get: (row) => row.categoryName,
        size: 220,
        enableSorting: false,
      }),
      col.text({
        id: 'partyName',
        header: 'Đối tác',
        get: (row) => row.partyName,
        size: 220,
        enableSorting: false,
      }),
      col.custom({
        id: 'receiptAmount',
        header: 'Thu (đ)',
        size: 150,
        enableSorting: false,
        cell: (row) => (
          <span className="font-medium text-admin-success-text">
            {row.direction === 'in' ? formatFinanceAmount(row.amount) : '—'}
          </span>
        ),
      }),
      col.custom({
        id: 'paymentAmount',
        header: 'Chi (đ)',
        size: 150,
        enableSorting: false,
        cell: (row) => (
          <span className="font-medium text-admin-red-dark">
            {row.direction === 'out' ? formatFinanceAmount(row.amount) : '—'}
          </span>
        ),
      }),
      col.custom({
        id: 'runningBalance',
        header: 'Số dư (đ)',
        size: 150,
        enableSorting: false,
        cell: (row) => (
          <span className="tabular-nums">
            {formatFinanceAmount(row.runningBalance)}
          </span>
        ),
      }),
      col.actions({
        id: 'actions',
        header: 'Thao tác',
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
  }, [onView]);
}
