/**
 * Scaffolded by table-builder from `src/project/finance/table/finance-account.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { FinanceAccount } from '@/project/finance/model/finance';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { useNumberFormat } from '@/providers/number-format-provider';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
  type StatusBadgeConfig,
} from '@/components/ui/data-grid-columns';
import { FinanceAccountStatusBadge } from '../components/finance-account-status-badge';

export const FINANCE_ACCOUNT_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

const accountTypeBadgeConfig: StatusBadgeConfig<string> = {
  cash: { label: 'Tiền mặt' },
  bank: { label: 'Ngân hàng' },
};

export interface UseFinanceAccountColumnsParams {
  onView: (row: FinanceAccount) => void;
}

export function useFinanceAccountColumns(
  params: UseFinanceAccountColumnsParams,
): ColumnDef<FinanceAccount>[] {
  const { formatNumber, formatCurrency, formatPercent } = useNumberFormat();
  const { onView } = params;

  return useMemo(() => {
    const col = createColumnHelpers<FinanceAccount>({
      formatNumber,
      formatCurrency,
      formatPercent,
    });

    return [
      col.text({
        id: 'code',
        header: 'Mã tài khoản',
        get: (row) => row.code,
        size: 160,
        enableSorting: false,
      }),
      col.text({
        id: 'name',
        header: 'Tên tài khoản',
        get: (row) => row.name,
        size: 320,
        enableSorting: false,
      }),
      col.badge({
        id: 'accountType',
        header: 'Loại',
        get: (row) => row.accountType,
        config: accountTypeBadgeConfig,
        size: 180,
        enableSorting: false,
      }),
      col.text({
        id: 'bankAccountNumber',
        header: 'Số tài khoản',
        get: (row) => row.bankAccountNumber,
        size: 220,
        enableSorting: false,
      }),
      col.text({
        id: 'currencyCode',
        header: 'Loại tiền',
        get: (row) => row.currencyCode,
        size: 160,
        enableSorting: false,
      }),
      col.currency({
        id: 'balance',
        header: 'Số dư',
        get: (row) => row.balance,
        size: 150,
        enableSorting: false,
      }),
      col.custom({
        id: 'isActive',
        header: 'Trạng thái',
        size: 170,
        enableSorting: false,
        cell: (row) => <FinanceAccountStatusBadge isActive={row.isActive} />,
      }),
      col.actions({
        id: 'actions',
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
  }, [formatNumber, formatCurrency, formatPercent, onView]);
}
