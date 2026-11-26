/**
 * Scaffolded by filter-builder from `src/project/handover/table/handover.filter.fixture.ts`. Run npm run gen:filter — do NOT hand-write this file.
 * You own this file now — keep domain state, renderers, and API mapping outside the builder.
 */
import type { ReactNode } from 'react';
import {
  FilterToolbar,
  type FilterToolbarOption,
} from '@/components/ui/filter-toolbar';

export type TypeFilterOption = FilterToolbarOption;
export type StatusFilterOption = FilterToolbarOption;

const HandoverFilterBarTypeOptions: FilterToolbarOption[] = [
  { value: 'transfer', label: 'Chuyển sở hữu' },
  { value: 'loan', label: 'Cho mượn' },
  { value: 'return', label: 'Trả lại' },
];

const HandoverFilterBarStatusOptions: FilterToolbarOption[] = [
  { value: 'draft', label: 'Bản nháp' },
  { value: 'pending', label: 'Chờ ký xác nhận' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'rejected', label: 'Đã từ chối' },
  { value: 'cancelled', label: 'Đã hủy' },
];

export interface HandoverFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  typeOptions?: readonly TypeFilterOption[];
  typeRenderOption?: (option: TypeFilterOption) => ReactNode;
  typeRenderValue?: (option: TypeFilterOption | undefined) => ReactNode;
  status: string;
  onStatusChange: (value: string) => void;
  statusOptions?: readonly StatusFilterOption[];
  statusRenderOption?: (option: StatusFilterOption) => ReactNode;
  statusRenderValue?: (option: StatusFilterOption | undefined) => ReactNode;
  disabled?: boolean;
  className?: string;
}

export function HandoverFilterBar({
  search,
  onSearchChange,
  type,
  onTypeChange,
  typeOptions,
  typeRenderOption,
  typeRenderValue,
  status,
  onStatusChange,
  statusOptions,
  statusRenderOption,
  statusRenderValue,
  disabled = false,
  className,
}: HandoverFilterBarProps) {
  return (
    <FilterToolbar
      className={className}
      fields={[
        {
          kind: 'search',
          value: search,
          onValueChange: onSearchChange,
          placeholder: 'Tìm mã phiếu hoặc vật tư',
          className: 'w-64',
          debounceMs: 300,
          disabled,
        },
        {
          kind: 'select',
          value: type,
          onValueChange: onTypeChange,
          options: typeOptions ?? HandoverFilterBarTypeOptions,
          label: 'Loại phiếu',
          placeholder: undefined,
          ariaLabel: undefined,
          className: 'w-44',
          disabled,
          renderOption: typeRenderOption,
          renderValue: typeRenderValue,
        },
        {
          kind: 'select',
          value: status,
          onValueChange: onStatusChange,
          options: statusOptions ?? HandoverFilterBarStatusOptions,
          label: 'Trạng thái',
          placeholder: undefined,
          ariaLabel: undefined,
          className: 'w-44',
          disabled,
          renderOption: statusRenderOption,
          renderValue: statusRenderValue,
        },
      ]}
    />
  );
}
