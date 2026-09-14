/**
 * Scaffolded by filter-builder from `src/project/reports/components/report-filter-bar.filter.fixture.ts`. Run npm run gen:filter — do NOT hand-write this file.
 * You own this file now — keep domain state, renderers, and API mapping outside the builder.
 */
import { FilterToolbar } from '@/components/ui/filter-toolbar';

export interface ReportFilterBarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ReportFilterBar({
  keyword,
  onKeywordChange,
  disabled = false,
  className,
}: ReportFilterBarProps) {
  return (
    <FilterToolbar
      className={className}
      fields={[
        {
          kind: 'search',
          value: keyword,
          onValueChange: onKeywordChange,
          placeholder: 'Tìm theo tên hoặc mô tả báo cáo',
          className: 'w-full sm:w-80',
          debounceMs: 300,
          disabled,
        },
      ]}
    />
  );
}
