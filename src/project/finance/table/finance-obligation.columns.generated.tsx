/**
 * Scaffolded by table-builder from `src/project/finance/table/finance-obligation.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { FinanceObligation } from '@/project/finance/model/finance';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { useNumberFormat } from '@/providers/number-format-provider';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';

export const FINANCE_OBLIGATION_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export interface UseFinanceObligationColumnsParams {
  onView: (row: FinanceObligation) => void;
}

export function useFinanceObligationColumns(
  params: UseFinanceObligationColumnsParams,
): ColumnDef<FinanceObligation>[] {
  const { formatNumber, formatCurrency, formatPercent } = useNumberFormat();
  const { onView } = params;

  return useMemo(() => {
    const col = createColumnHelpers<FinanceObligation>({
      formatNumber,
      formatCurrency,
      formatPercent,
    });

    return [
      col.text({
        id: 'code',
        header: 'Mã nợ',
        get: (row) => row.code,
        size: 160,
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
        id: 'sourceType',
        header: 'Nguồn',
        get: (row) => row.sourceType,
        size: 120,
        enableSorting: false,
      }),
      col.text({
        id: 'contractName',
        header: 'Hợp đồng',
        get: (row) => row.contractName,
        size: 220,
        enableSorting: false,
      }),
      col.date({
        id: 'dueDate',
        header: 'Hạn thanh toán',
        get: (row) => row.dueDate,
        size: 150,
        enableSorting: false,
      }),
      col.currency({
        id: 'originalAmount',
        header: 'Gốc',
        get: (row) => row.originalAmount,
        size: 150,
        enableSorting: false,
      }),
      col.currency({
        id: 'settledAmount',
        header: 'Đã trả',
        get: (row) => row.settledAmount,
        size: 150,
        enableSorting: false,
      }),
      col.currency({
        id: 'outstandingAmount',
        header: 'Còn nợ',
        get: (row) => row.outstandingAmount,
        size: 150,
        enableSorting: false,
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
