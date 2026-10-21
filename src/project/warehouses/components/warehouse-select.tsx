import { useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { OptionSelect } from '@/components/ui/option-select';
import type { OptionSelectProps } from '@/components/ui/option-select';
import { useWarehousesQuery } from '../hooks/use-warehouses';
import type { Warehouse } from '../model/warehouse';

export type WarehouseSelectProps = Omit<
  OptionSelectProps<{ warehouse: Warehouse }>,
  | 'options'
  | 'selectedOption'
  | 'renderOption'
  | 'loading'
  | 'loadingMessage'
  | 'emptyMessage'
> & {
  sourceMode?: 'fetch' | 'options';
  warehouses?: readonly Warehouse[];
};

export function WarehouseSelect({
  value = '',
  placeholder,
  sourceMode = 'fetch',
  warehouses,
  ...props
}: WarehouseSelectProps) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const query = useWarehousesQuery(
    false,
    sourceMode === 'fetch' && !props.disabled && (open || Boolean(value)),
  );
  const options = useMemo(
    () =>
      (sourceMode === 'options' ? (warehouses ?? []) : (query.data ?? [])).map(
        (warehouse) => ({
          value: warehouse.id,
          label: warehouse.name,
          searchableText: `${warehouse.code} ${warehouse.name} ${warehouse.address}`,
          data: { warehouse },
        }),
      ),
    [query.data, sourceMode, warehouses],
  );
  const prompt =
    placeholder ?? intl.formatMessage({ id: 'warehouses.select.placeholder' });

  return (
    <OptionSelect
      {...props}
      value={value}
      options={options}
      selectedOption={options.find((option) => option.value === value)}
      placeholder={prompt}
      searchPlaceholder={intl.formatMessage({ id: 'warehouses.select.search' })}
      loading={sourceMode === 'fetch' && query.isPending && query.isFetching}
      loadingMessage={intl.formatMessage({ id: 'common.state.loading' })}
      errorMessage={
        sourceMode === 'fetch' && query.isError
          ? getApiErrorMessage(query.error)
          : undefined
      }
      retryLabel={intl.formatMessage({ id: 'common.actions.retry' })}
      onRetry={() => {
        if (sourceMode === 'fetch' && !query.isFetching)
          void query.refetch({ cancelRefetch: false });
      }}
      emptyMessage={intl.formatMessage({ id: 'warehouses.select.empty' })}
      canDeselect={false}
      renderOption={(option) =>
        option.data ? (
          <span className="flex min-w-0 items-center gap-2">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate">
              {option.data.warehouse.name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {option.data.warehouse.code}
            </span>
          </span>
        ) : (
          option.label
        )
      }
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        props.onOpenChange?.(nextOpen);
      }}
    />
  );
}
