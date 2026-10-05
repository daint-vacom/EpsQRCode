/**
 * Scaffolded by table-builder from `src/project/work/table/work.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo, type ReactNode } from 'react';
import { TagList } from '@/project/tags/components/tag-list';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import { WorkStatusBadge } from '../components/work-status-badge';
import type { WorkItem } from '../model/work';

type Work = WorkItem;

export const WORK_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export interface UseWorkColumnsParams {
  onView: (row: Work) => void;
  onEdit: (row: Work) => void;
  onDelete: (row: Work) => void;
  renderWork: (row: Work) => ReactNode;
  renderAssignee: (row: Work) => ReactNode;
  renderPlannedSchedule: (row: Work) => ReactNode;
  renderActualSchedule: (row: Work) => ReactNode;
  renderLinks: (row: Work) => ReactNode;
}

export function useWorkColumns(
  params: UseWorkColumnsParams,
): ColumnDef<Work>[] {
  return useMemo(() => {
    const col = createColumnHelpers<Work>();

    return [
      col.custom({
        id: 'status',
        header: 'Trạng thái',
        size: 170,
        enableSorting: false,
        cell: (row) => <WorkStatusBadge status={row.status} />,
      }),
      col.custom({
        id: 'work',
        header: 'Công việc',
        headerClassName: 'min-w-[340px]',
        size: 360,
        enableSorting: false,
        cell: (row) => params.renderWork(row),
      }),
      col.custom({
        id: 'assignee',
        header: 'Phụ trách',
        headerClassName: 'min-w-[220px]',
        size: 220,
        enableSorting: false,
        cell: (row) => params.renderAssignee(row),
      }),
      col.custom({
        id: 'labels',
        header: 'Nhãn công việc',
        headerClassName: 'min-w-[200px]',
        size: 220,
        enableSorting: false,
        cell: (row) => <TagList tags={row.labels} />,
      }),
      col.custom({
        id: 'plannedSchedule',
        header: 'Thời gian dự kiến',
        headerClassName: 'w-[240px]',
        size: 240,
        enableSorting: false,
        cell: (row) => params.renderPlannedSchedule(row),
      }),
      col.custom({
        id: 'actualSchedule',
        header: 'Thời gian thực tế',
        headerClassName: 'w-[240px]',
        size: 240,
        enableSorting: false,
        cell: (row) => params.renderActualSchedule(row),
      }),
      col.custom({
        id: 'links',
        header: 'Liên kết',
        headerClassName: 'w-[240px]',
        size: 240,
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
