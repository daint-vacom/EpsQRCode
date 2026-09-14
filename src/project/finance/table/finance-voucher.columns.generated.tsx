/**
 * Scaffolded by table-builder from `src/project/finance/table/finance-voucher.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { FinanceVoucher } from '@/project/finance/model/finance';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Eye, Pencil } from 'lucide-react';
import { useNumberFormat } from '@/providers/number-format-provider';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
  type StatusBadgeConfig,
} from '@/components/ui/data-grid-columns';

export const FINANCE_VOUCHER_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

const voucherTypeBadgeConfig: StatusBadgeConfig<string> = {
  receipt: { label: 'Phiếu thu', variant: 'success' },
  payment: { label: 'Phiếu chi', variant: 'destructive' },
};

const statusBadgeConfig: StatusBadgeConfig<string> = {
  draft: { label: 'Nháp', variant: 'outline' },
  posted: { label: 'Đã ghi nhận', variant: 'success' },
  cancelled: { label: 'Đã hủy', variant: 'destructive' },
  reversed: { label: 'Đã đảo', variant: 'warning' },
};

export interface UseFinanceVoucherColumnsParams {
  onView: (row: FinanceVoucher) => void;
  onEdit: (row: FinanceVoucher) => void;
}

export function useFinanceVoucherColumns(
  params: UseFinanceVoucherColumnsParams,
): ColumnDef<FinanceVoucher>[] {
  const { formatNumber, formatCurrency, formatPercent } = useNumberFormat();

  return useMemo(() => {
    const col = createColumnHelpers<FinanceVoucher>({
      formatNumber,
      formatCurrency,
      formatPercent,
    });

    return [
      col.text({
        id: 'voucherNo',
        header: 'Số phiếu',
        get: (row) => row.voucherNo,
        size: 160,
        enableSorting: false,
      }),
      col.date({
        id: 'voucherDate',
        header: 'Ngày giao dịch',
        get: (row) => row.voucherDate,
        size: 150,
        enableSorting: false,
      }),
      col.badge({
        id: 'voucherType',
        header: 'Thu/Chi',
        get: (row) => row.voucherType,
        config: voucherTypeBadgeConfig,
        size: 180,
        enableSorting: false,
      }),
      col.text({
        id: 'partyNameSnapshot',
        header: 'Đối tượng',
        get: (row) => row.partyNameSnapshot,
        size: 320,
        enableSorting: false,
      }),
      col.text({
        id: 'description',
        header: 'Nội dung',
        get: (row) => row.description,
        size: 280,
        enableSorting: false,
      }),
      col.text({
        id: 'accountName',
        header: 'Quỹ/tài khoản',
        get: (row) => row.accountName,
        size: 220,
        enableSorting: false,
      }),
      col.currency({
        id: 'totalAmount',
        header: 'Tổng tiền',
        get: (row) => row.totalAmount,
        size: 150,
        enableSorting: false,
      }),
      col.badge({
        id: 'status',
        header: 'Trạng thái',
        get: (row) => row.status,
        config: statusBadgeConfig,
        size: 170,
        enableSorting: false,
      }),
      col.actions({
        id: 'actions',
        header: '',
        size: getDataGridActionsColumnSize(2),
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
              onClick={() => params.onView(row)}
            >
              <Eye className="size-4" />
            </DataGridActionButton>
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
          </div>
        ),
      }),
    ];
  }, [
    formatNumber,
    formatCurrency,
    formatPercent,
    params.onView,
    params.onEdit,
  ]);
}
