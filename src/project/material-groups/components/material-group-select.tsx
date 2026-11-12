import { useMemo, useState } from 'react';
import { Folder } from 'lucide-react';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { OptionSelect } from '@/components/ui/option-select';
import type {
  OptionSelectProps,
  SelectOption,
} from '@/components/ui/option-select';
import { SelectOptionContent } from '@/components/ui/select-option-content';
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

export function MaterialGroupSelect({
  value = '',
  placeholder,
  onOpenChange,
  sourceMode = 'fetch',
  groups,
  canDeselect = false,
  ...props
}: MaterialGroupSelectProps) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const selectPlaceholder =
    placeholder ??
    intl.formatMessage({ id: 'materialGroups.select.placeholder' });
  const shouldFetch = sourceMode === 'fetch';
  const query = useAvailableMaterialGroupsQuery(
    shouldFetch && !props.disabled && (open || Boolean(value)),
  );
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
      loading={shouldFetch && query.isPending && query.isFetching}
      errorMessage={
        shouldFetch && query.isError
          ? getApiErrorMessage(query.error)
          : undefined
      }
      retryLabel={intl.formatMessage({ id: 'common.actions.retry' })}
      onRetry={() => {
        if (shouldFetch && !query.isFetching)
          void query.refetch({ cancelRefetch: false });
      }}
      loadingMessage={intl.formatMessage({ id: 'common.state.loading' })}
      emptyMessage={
        shouldFetch && query.isError
          ? getApiErrorMessage(query.error)
          : intl.formatMessage({ id: 'materialGroups.select.empty' })
      }
      canDeselect={canDeselect}
      optionContentClassName="overflow-visible whitespace-normal"
      renderOption={(option) =>
        option.data ? (
          <SelectOptionContent
            title={option.data.title}
            description={option.data.description}
          />
        ) : (
          option.label
        )
      }
      onOpenChange={(open) => {
        setOpen(open);
        onOpenChange?.(open);
      }}
    />
  );
}
