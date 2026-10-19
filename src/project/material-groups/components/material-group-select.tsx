import { useMemo } from 'react';
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
>;

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
  ...props
}: MaterialGroupSelectProps) {
  const intl = useIntl();
  const query = useAvailableMaterialGroupsQuery();
  const options = useMemo<SelectOption<MaterialGroupSelectItem>[]>(
    () =>
      (query.data ?? []).map((group) => {
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
      }),
    [query.data],
  );

  return (
    <OptionSelect
      {...props}
      value={value}
      options={options}
      selectedOption={options.find((option) => option.value === value)}
      placeholder={
        placeholder ??
        intl.formatMessage({ id: 'materialGroups.select.placeholder' })
      }
      searchPlaceholder={intl.formatMessage({
        id: 'materialGroups.select.search',
      })}
      loading={query.isPending}
      loadingMessage={intl.formatMessage({ id: 'common.state.loading' })}
      emptyMessage={
        query.isError
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
        if (open && query.isError) void query.refetch();
      }}
    />
  );
}
