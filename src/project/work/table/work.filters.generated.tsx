/**
 * Scaffolded by filter-builder from `src/project/work/table/work.filters.fixture.ts`. Run npm run gen:filter — do NOT hand-write this file.
 * You own this file now — keep domain state, renderers, and API mapping outside the builder.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  FilterToolbar,
  type FilterToolbarOption,
} from '@/components/ui/filter-toolbar';
import {
  SelectWithAvatar,
  type SelectWithAvatarOption,
} from '@/components/ui/select-with-avatar';
import type { WorkEmployeeOption } from '../model/work';

export type StatusFilterOption = FilterToolbarOption;
export type PriorityFilterOption = FilterToolbarOption;

export interface WorkFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  statusOptions: readonly StatusFilterOption[];
  statusRenderOption?: (option: StatusFilterOption) => ReactNode;
  statusRenderValue?: (option: StatusFilterOption | undefined) => ReactNode;
  priority: string;
  onPriorityChange: (value: string) => void;
  priorityOptions: readonly PriorityFilterOption[];
  priorityRenderOption?: (option: PriorityFilterOption) => ReactNode;
  priorityRenderValue?: (option: PriorityFilterOption | undefined) => ReactNode;
  assignee: string;
  onAssigneeChange: (value: string) => void;
  assigneeOptions: readonly SelectWithAvatarOption<WorkEmployeeOption>[];
  disabled?: boolean;
  className?: string;
}

export function WorkFilterBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  statusOptions,
  statusRenderOption,
  statusRenderValue,
  priority,
  onPriorityChange,
  priorityOptions,
  priorityRenderOption,
  priorityRenderValue,
  assignee,
  onAssigneeChange,
  assigneeOptions,
  disabled = false,
  className,
}: WorkFilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <FilterToolbar
        fields={[
          {
            kind: 'search',
            value: search,
            onValueChange: onSearchChange,
            placeholder: 'Tìm theo mã hoặc tên công việc',
            className: 'w-72',
            debounceMs: 300,
            disabled,
          },
          {
            kind: 'select',
            value: status,
            onValueChange: onStatusChange,
            options: statusOptions ?? [],
            placeholder: 'Trạng thái',
            className: 'w-40',
            disabled,
            renderOption: statusRenderOption,
            renderValue: statusRenderValue,
          },
          {
            kind: 'select',
            value: priority,
            onValueChange: onPriorityChange,
            options: priorityOptions ?? [],
            placeholder: 'Ưu tiên',
            className: 'w-40',
            disabled,
            renderOption: priorityRenderOption,
            renderValue: priorityRenderValue,
          },
        ]}
      />
      {assigneeOptions.length > 0 ? (
        <SelectWithAvatar
          value={assignee}
          onChange={onAssigneeChange}
          options={assigneeOptions}
          placeholder="NV phụ trách"
          searchPlaceholder="Tìm theo tên hoặc mã nhân viên..."
          emptyMessage="Không tìm thấy nhân viên phù hợp"
          ariaLabel="Phụ trách"
          size="md"
          variant="normal"
          className="w-44"
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}
