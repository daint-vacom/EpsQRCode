/**
 * Scaffolded by filter-builder from `src/project/work/table/work.filters.fixture.ts`. Run npm run gen:filter — do NOT hand-write this file.
 * You own this file now — keep domain state, renderers, and API mapping outside the builder.
 */
import type { ReactNode } from 'react';
import {
  FilterToolbar,
  type FilterToolbarOption,
} from '@/components/ui/filter-toolbar';

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
  disabled = false,
  className,
}: WorkFilterBarProps) {
  return (
    <FilterToolbar
      className={className}
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
          label: 'Trạng thái',
          placeholder: 'Trạng thái',
          ariaLabel: undefined,
          className: undefined,
          disabled,
          renderOption: statusRenderOption,
          renderValue: statusRenderValue,
        },
        {
          kind: 'select',
          value: priority,
          onValueChange: onPriorityChange,
          options: priorityOptions ?? [],
          label: 'Ưu tiên',
          placeholder: 'Ưu tiên',
          ariaLabel: undefined,
          className: undefined,
          disabled,
          renderOption: priorityRenderOption,
          renderValue: priorityRenderValue,
        },
      ]}
    />
  );
}
