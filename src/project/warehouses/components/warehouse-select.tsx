import { useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { OptionSelect } from '@/components/ui/option-select';
import type {
  OptionSelectProps,
  SelectOption,
} from '@/components/ui/option-select';
import { SelectOptionContent } from '@/components/ui/select-option-content';
import { useWarehousesQuery } from '../hooks/use-warehouses';
import type { Warehouse } from '../model/warehouse';

export type WarehouseSelectItem = Pick<Warehouse, 'id' | 'code' | 'name'> &
  Partial<Pick<Warehouse, 'address'>>;

export type WarehouseSelectProps = Omit<
  OptionSelectProps<{ warehouse: WarehouseSelectItem }>,
  'options' | 'renderOption' | 'loading' | 'loadingMessage' | 'emptyMessage'
> & {
  sourceMode?: 'fetch' | 'options';
  warehouses?: readonly WarehouseSelectItem[];
  selectedOption?: SelectOption<{ warehouse: WarehouseSelectItem }>;
};

export function WarehouseSelect({
  value = '',
  placeholder,
  sourceMode = 'fetch',
  warehouses,
  canDeselect = false,
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
      selectedOption={
        options.find((option) => option.value === value) ?? props.selectedOption
      }
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
      canDeselect={canDeselect}
      optionContentClassName="overflow-visible whitespace-normal"
      renderOption={(option) =>
        option.data ? (
          <SelectOptionContent
            title={option.data.warehouse.name}
            description={option.data.warehouse.code}
            leading={
              <Building2 className="size-4 shrink-0 text-muted-foreground" />
            }
          />
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
