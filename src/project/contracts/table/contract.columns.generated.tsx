/**
 * Scaffolded by table-builder from `src/project/contracts/table/contract.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useNumberFormat } from '@/providers/number-format-provider';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import type { CustomerSelectOption } from '../../customers/api/customers.api';
import { ContractCustomerCell } from '../components/contract-cell';
import { ContractDateCell } from '../components/contract-date-cell';
import { ContractStatusBadge } from '../components/contract-status-badge';
import type { Contract, ContractStatus } from '../model/contract';
import {
  CONTRACT_STATUS_FILTER_OPTIONS,
  ContractIdentityColumnFilter,
} from './contract-column-filters';
import {
  ContractNextDueColumnFilter,
  ContractOutstandingColumnFilter,
  ContractStatusColumnFilter,
} from './contract-column-filters.generated';

export const CONTRACT_COLUMN_PINNING: ColumnPinningState = {
  left: ['select'],
  right: ['actions'],
};

export interface UseContractColumnsParams {
  onEdit: (contract: Contract) => void;
  onDelete: (contract: Contract) => void;
  contractSearch: string;
  onContractSearchChange: (value: string) => void;
  customerId: string;
  customerOptions: CustomerSelectOption[];
  customerOptionsLoading?: boolean;
  onCustomerIdChange: (value: string) => void;
  contractRenewalReminderDays: number;
  paymentReminderDays: number;
  statuses: ContractStatus[];
  onStatusChange: (value: ContractStatus[]) => void;
  outstandingMin?: number;
  outstandingMax?: number;
  onOutstandingChange: (value: { min?: number; max?: number }) => void;
  nextDueFrom: string;
  nextDueTo: string;
  onNextDueChange: (value: { from?: string; to?: string }) => void;
}

export function useContractColumns(
  params: UseContractColumnsParams,
): ColumnDef<Contract>[] {
  const { formatNumber, formatCurrency, formatPercent } = useNumberFormat();

  return useMemo(() => {
    const col = createColumnHelpers<Contract>({
      formatNumber,
      formatCurrency,
      formatPercent,
    });

    return [
      col.select(),
      col.custom({
        id: 'contract',
        header: 'Hợp đồng',
        headerFilter: (
          <ContractIdentityColumnFilter
            contractSearch={params.contractSearch}
            onContractSearchChange={params.onContractSearchChange}
            customerId={params.customerId}
            customerOptions={params.customerOptions}
            customerOptionsLoading={params.customerOptionsLoading}
            onCustomerIdChange={params.onCustomerIdChange}
          />
        ),
        headerClassName: 'min-w-[440px]',
        size: 480,
        enableSorting: false,
        cell: (row) => <ContractCustomerCell contract={row} />,
      }),
      col.custom({
        id: 'status',
        header: 'Trạng thái',
        headerFilter: (
          <ContractStatusColumnFilter
            value={params.statuses}
            options={CONTRACT_STATUS_FILTER_OPTIONS}
            onChange={(value) =>
              params.onStatusChange(value as typeof params.statuses)
            }
          />
        ),
        headerClassName: 'w-[140px]',
        size: 140,
        enableSorting: false,
        cell: (row) => <ContractStatusBadge status={row.status} />,
      }),
      col.custom({
        id: 'endDate',
        header: 'Ngày hết hạn hợp đồng',
        headerClassName: 'w-[190px]',
        size: 190,
        enableSorting: false,
        cell: (row) => (
          <ContractDateCell
            date={row.endDate}
            reminderDays={params.contractRenewalReminderDays}
            emptyLabel="Không giới hạn"
          />
        ),
      }),
      col.custom({
        id: 'nextDueDate',
        header: 'Hạn thu tiếp theo',
        headerFilter: (
          <ContractNextDueColumnFilter
            value={{ from: params.nextDueFrom, to: params.nextDueTo }}
            onChange={params.onNextDueChange}
          />
        ),
        headerClassName: 'w-[160px]',
        size: 160,
        enableSorting: false,
        cell: (row) => (
          <ContractDateCell
            date={row.nextDueDate}
            reminderDays={params.paymentReminderDays}
            emptyLabel="Chưa phát sinh"
          />
        ),
      }),
      col.currency({
        id: 'totalOutstanding',
        header: 'Còn phải thu',
        get: (row) => row.totalOutstanding,
        headerFilter: (
          <ContractOutstandingColumnFilter
            value={{ min: params.outstandingMin, max: params.outstandingMax }}
            onChange={params.onOutstandingChange}
          />
        ),
        headerClassName: 'w-[150px]',
        cellClassName: 'px-3',
        size: 150,
        enableSorting: false,
      }),
      col.actions({
        id: 'actions',
        header: '',
        size: getDataGridActionsColumnSize(2),
        cellClassName: 'text-center',
        enableSorting: false,
        cell: (row) => (
          <div className="flex justify-center gap-1">
            <DataGridActionButton
              action="edit"
              tooltip="Sửa"
              type="button"
              mode="icon"
              size="sm"
              aria-label={`Sửa hợp đồng ${row.name}`}
              onClick={() => params.onEdit(row)}
            >
              <Pencil className="size-4" />
            </DataGridActionButton>
            <DataGridActionButton
              action="delete"
              tooltip="Xóa"
              type="button"
              mode="icon"
              size="sm"
              aria-label={`Xóa hợp đồng ${row.name}`}
              onClick={() => params.onDelete(row)}
            >
              <Trash2 className="size-4" />
            </DataGridActionButton>
          </div>
        ),
      }),
    ];
  }, [formatCurrency, formatNumber, formatPercent, params]);
}
