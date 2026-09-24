/**
 * Scaffolded by table-builder from `src/project/work/table/work-template.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useNumberFormat } from '@/providers/number-format-provider';
import { Badge } from '@/components/ui/badge';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import { Switch } from '@/components/ui/switch';
import type { WorkTemplateSummary } from '../model/work';
import { WORK_PRIORITY_LABELS } from '../model/work';

export const WORK_TEMPLATE_SUMMARY_COLUMN_PINNING: ColumnPinningState = {
  left: ['select'],
  right: ['actions'],
};

export interface UseWorkTemplateSummaryColumnsParams {
  onEdit: (row: WorkTemplateSummary) => void;
  onDelete: (row: WorkTemplateSummary) => void;
  employeeNamesById: Record<string, string>;
  onAvailabilityChange: (row: WorkTemplateSummary, isActive: boolean) => void;
  isAvailabilityPending: boolean;
  templateColumnSize: number;
}

export function useWorkTemplateSummaryColumns(
  params: UseWorkTemplateSummaryColumnsParams,
): ColumnDef<WorkTemplateSummary>[] {
  const { formatNumber, formatCurrency, formatPercent } = useNumberFormat();
  const {
    employeeNamesById,
    onEdit,
    onDelete,
    onAvailabilityChange,
    isAvailabilityPending,
    templateColumnSize,
  } = params;

  return useMemo(() => {
    const col = createColumnHelpers<WorkTemplateSummary>({
      formatNumber,
      formatCurrency,
      formatPercent,
    });

    return [
      col.select(),
      col.custom({
        id: 'availability',
        header: 'Có thể sử dụng',
        size: 140,
        enableSorting: false,
        cell: (row) => (
          <div className="flex items-center justify-center">
            <Switch
              size="sm"
              checked={row.isActive}
              disabled={isAvailabilityPending}
              aria-label={`${row.isActive ? 'Tắt' : 'Bật'} khả năng sử dụng mẫu ${row.name}`}
              onCheckedChange={(checked) => onAvailabilityChange(row, checked)}
            />
          </div>
        ),
      }),
      col.custom({
        id: 'template',
        header: 'Mẫu công việc',
        headerClassName: 'min-w-[220px]',
        size: templateColumnSize,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-semibold text-foreground">
              {row.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {row.code}
            </span>
          </div>
        ),
      }),
      col.custom({
        id: 'labels',
        header: 'Nhãn',
        size: 180,
        enableSorting: false,
        cell: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.labels.slice(0, 2).map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                className="max-w-32 truncate"
                style={{ color: label.color, borderColor: label.color }}
              >
                {label.name}
              </Badge>
            ))}
            {row.labels.length > 2 ? (
              <Badge variant="secondary">+{row.labels.length - 2}</Badge>
            ) : null}
          </div>
        ),
      }),
      col.number({
        id: 'childCount',
        header: 'Công việc con',
        get: (row) => row.childCount,
        size: 140,
        enableSorting: false,
      }),
      col.date({
        id: 'updatedAt',
        header: 'Cập nhật gần nhất',
        get: (row) => row.updatedAt,
        size: 150,
        enableSorting: false,
      }),
      col.custom({
        id: 'priority',
        header: 'Ưu tiên',
        size: 140,
        enableSorting: false,
        cell: (row) => (
          <span className="text-sm">{WORK_PRIORITY_LABELS[row.priority]}</span>
        ),
      }),
      col.custom({
        id: 'assignee',
        header: 'Phụ trách',
        cellClassName: 'truncate',
        size: 180,
        enableSorting: false,
        cell: (row) => (
          <span className="block truncate text-sm">
            {row.assigneeEmployeeId
              ? (employeeNamesById[row.assigneeEmployeeId] ?? '')
              : ''}
          </span>
        ),
      }),
      col.actions({
        id: 'actions',
        header: '',
        cellClassName: 'text-center',
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
              onClick={() => onEdit(row)}
            >
              <Pencil className="size-4" />
            </DataGridActionButton>
            <DataGridActionButton
              action="delete"
              tooltip="Xóa"
              aria-label={`Xóa mẫu công việc ${row.name}`}
              type="button"
              mode="icon"
              size="sm"
              onClick={() => onDelete(row)}
            >
              <Trash2 className="size-4" />
            </DataGridActionButton>
          </div>
        ),
      }),
    ];
  }, [
    employeeNamesById,
    formatCurrency,
    formatNumber,
    formatPercent,
    isAvailabilityPending,
    onDelete,
    onAvailabilityChange,
    onEdit,
    templateColumnSize,
  ]);
}
