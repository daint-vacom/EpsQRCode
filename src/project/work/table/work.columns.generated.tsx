/**
 * Scaffolded by table-builder from `src/project/work/table/work.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo, type ReactNode } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
  type StatusBadgeConfig,
} from '@/components/ui/data-grid-columns';
import type { WorkItem } from '../model/work';

type Work = WorkItem;

export const WORK_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

const statusBadgeConfig: StatusBadgeConfig<string> = {
  draft: {
    label: 'Bản nháp',
    className:
      'border-transparent bg-muted px-2.5 py-1 text-xs text-muted-foreground',
    dotClassName: 'bg-muted-foreground',
  },
  todo: {
    label: 'Chưa thực hiện',
    className:
      'border-transparent bg-admin-blue-bg px-2.5 py-1 text-xs text-admin-blue-text',
    dotClassName: 'bg-admin-blue-primary',
  },
  in_progress: {
    label: 'Đang thực hiện',
    className:
      'border-transparent bg-admin-amber-bg px-2.5 py-1 text-xs text-admin-amber-dark',
    dotClassName: 'bg-admin-amber-primary',
  },
  paused: {
    label: 'Tạm dừng',
    className:
      'border-transparent bg-muted px-2.5 py-1 text-xs text-muted-foreground',
    dotClassName: 'bg-muted-foreground',
  },
  completed: {
    label: 'Hoàn thành',
    className:
      'border-transparent bg-admin-success-bg px-2.5 py-1 text-xs text-admin-success-text',
    dotClassName: 'bg-admin-success-dot',
  },
  cancelled: {
    label: 'Đã hủy',
    className:
      'border-transparent bg-admin-red-bg px-2.5 py-1 text-xs text-admin-red-dark',
    dotClassName: 'bg-admin-red-primary',
  },
};

export interface UseWorkColumnsParams {
  onView: (row: Work) => void;
  onEdit: (row: Work) => void;
  onDelete: (row: Work) => void;
  renderWork: (row: Work) => ReactNode;
  renderAssignee: (row: Work) => ReactNode;
  renderDates: (row: Work) => ReactNode;
  renderLinks: (row: Work) => ReactNode;
}

export function useWorkColumns(
  params: UseWorkColumnsParams,
): ColumnDef<Work>[] {
  return useMemo(() => {
    const col = createColumnHelpers<Work>();

    return [
      col.custom({
        id: 'work',
        header: 'Công việc',
        headerClassName: 'min-w-[340px]',
        size: 360,
        enableSorting: false,
        cell: (row) => params.renderWork(row),
      }),
      col.badge({
        id: 'status',
        header: 'Trạng thái',
        get: (row) => row.status,
        config: statusBadgeConfig,
        size: 170,
        enableSorting: false,
      }),
      col.custom({
        id: 'assignee',
        header: 'Phụ trách',
        headerClassName: 'w-[190px]',
        size: 190,
        enableSorting: false,
        cell: (row) => params.renderAssignee(row),
      }),
      col.custom({
        id: 'dates',
        header: 'Thời gian',
        headerClassName: 'w-[210px]',
        size: 210,
        enableSorting: false,
        cell: (row) => params.renderDates(row),
      }),
      col.custom({
        id: 'links',
        header: 'Liên kết',
        headerClassName: 'w-[220px]',
        size: 220,
        enableSorting: false,
        cell: (row) => params.renderLinks(row),
      }),
      col.actions({
        id: 'actions',
        header: '',
        cellClassName: 'text-center',
        size: getDataGridActionsColumnSize(3),
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
  }, [params]);
}
