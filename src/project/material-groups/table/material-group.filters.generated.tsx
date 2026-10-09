/**
 * Scaffolded by filter-builder from `src/project/material-groups/table/material-group.filters.fixture.ts`. Run npm run gen:filter — do NOT hand-write this file.
 * You own this file now — keep domain state, renderers, and API mapping outside the builder.
 */
import { useIntl } from 'react-intl';
import { FilterToolbar } from '@/components/ui/filter-toolbar';

export interface MaterialGroupFilterBarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function MaterialGroupFilterBar({
  keyword,
  onKeywordChange,
  disabled = false,
  className,
}: MaterialGroupFilterBarProps) {
  const intl = useIntl();
  return (
    <FilterToolbar
      className={className}
      fields={[
        {
          kind: 'search',
          value: keyword,
          onValueChange: onKeywordChange,
          placeholder: intl.formatMessage({
            id: 'materialGroups.filters.searchPlaceholder',
          }),
          className: 'w-64',
          debounceMs: 300,
          disabled,
        },
      ]}
    />
  );
}
