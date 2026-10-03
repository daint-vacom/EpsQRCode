import { cn } from '@/lib/utils';
import { TagSelect } from './tag-select';

export interface TagColumnFilterProps {
  value: string[];
  onChange: (tagIds: string[]) => void;
  moduleCodes: string[];
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
}

/** Shared grouped multi-select used by tag columns across list tables. */
export function TagColumnFilter({
  value,
  onChange,
  moduleCodes,
  disabled = false,
  className,
  ariaLabel = 'Nhóm/danh mục',
  placeholder = '',
  size = 'sm',
}: TagColumnFilterProps) {
  return (
    <TagSelect
      value={value}
      onChange={onChange}
      moduleCodes={moduleCodes}
      allowCustomGroups
      placeholder={placeholder}
      searchPlaceholder="Tìm danh mục..."
      ariaLabel={ariaLabel}
      size={size}
      disabled={disabled}
      className={cn('min-w-[200px]', className)}
    />
  );
}
