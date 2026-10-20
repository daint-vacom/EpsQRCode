import { useMemo } from 'react';
import { Folder } from 'lucide-react';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { OptionSelect } from '@/components/ui/option-select';
import type {
  OptionSelectProps,
  SelectOption,
} from '@/components/ui/option-select';
import { useAvailableMaterialGroupsQuery } from '../hooks/use-material-groups';
import type { MaterialGroup } from '../model/material-group';

interface MaterialGroupSelectItem {
  title: string;
  description: string;
  group: MaterialGroup;
}

export type MaterialGroupSelectProps = Omit<
  OptionSelectProps<MaterialGroupSelectItem>,
  | 'options'
  | 'selectedOption'
  | 'renderOption'
  | 'optionContentClassName'
  | 'loading'
  | 'loadingMessage'
  | 'emptyMessage'
> & {
  sourceMode?: 'fetch' | 'options';
  groups?: readonly MaterialGroup[];
};

function MaterialGroupOption({ item }: { item: MaterialGroupSelectItem }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5 text-start">
      <span className="block truncate text-sm font-medium text-foreground">
        {item.title}
      </span>
      <span className="block truncate text-xs text-muted-foreground">
        {item.description}
      </span>
    </span>
  );
}

export function MaterialGroupSelect({
  value = '',
  placeholder,
  onOpenChange,
  sourceMode = 'fetch',
  groups,
  ...props
}: MaterialGroupSelectProps) {
  const intl = useIntl();
  const selectPlaceholder =
    placeholder ??
    intl.formatMessage({ id: 'materialGroups.select.placeholder' });
  const shouldFetch = sourceMode === 'fetch';
  const query = useAvailableMaterialGroupsQuery(shouldFetch);
  const options = useMemo<SelectOption<MaterialGroupSelectItem>[]>(
    () =>
      (sourceMode === 'options' ? (groups ?? []) : (query.data ?? [])).map(
        (group) => {
          const item = {
            title: group.name,
            description: group.code,
            group,
          };
          return {
            value: group.id,
            label: item.title,
            searchableText: `${item.title} ${item.description}`,
            data: item,
          };
        },
      ),
    [groups, query.data, sourceMode],
  );

  return (
    <OptionSelect
      {...props}
      value={value}
      options={options}
      selectedOption={options.find((option) => option.value === value)}
      placeholder={selectPlaceholder}
      triggerContent={(option) => (
        <span className="flex min-w-0 items-center gap-2">
          <Folder className="size-4 shrink-0 text-muted-foreground" />
          <span
            className={option ? 'truncate' : 'truncate text-muted-foreground'}
          >
            {option?.label ?? selectPlaceholder}
          </span>
        </span>
      )}
      searchPlaceholder={intl.formatMessage({
        id: 'materialGroups.select.search',
      })}
      loading={shouldFetch && query.isPending}
      loadingMessage={intl.formatMessage({ id: 'common.state.loading' })}
      emptyMessage={
        shouldFetch && query.isError
          ? getApiErrorMessage(query.error)
          : intl.formatMessage({ id: 'materialGroups.select.empty' })
      }
      canDeselect={false}
      optionContentClassName="overflow-visible whitespace-normal"
      renderOption={(option) =>
        option.data ? <MaterialGroupOption item={option.data} /> : option.label
      }
      onOpenChange={(open) => {
        onOpenChange?.(open);
        if (shouldFetch && open && query.isError) void query.refetch();
      }}
    />
  );
}
