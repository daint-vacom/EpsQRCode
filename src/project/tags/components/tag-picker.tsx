import {
  MultiSelect,
  type MultiSelectOption,
} from '@/components/ui/multi-select/multi-select';

export interface TagPickerProps {
  value: string[];
  options: MultiSelectOption[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

/** Presentation-only picker; persistence stays in the parent/domain API. */
export function TagPicker({
  value,
  options,
  onChange,
  disabled,
  placeholder = 'Chọn danh mục',
}: TagPickerProps) {
  return (
    <MultiSelect
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      searchPlaceholder="Tìm danh mục..."
      emptyMessage="Không tìm thấy danh mục"
    />
  );
}
