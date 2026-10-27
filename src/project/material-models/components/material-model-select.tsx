import { useMemo, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { OptionSelect } from '@/components/ui/option-select';
import type {
  OptionSelectProps,
  SelectOption,
} from '@/components/ui/option-select';
import { useMaterialModelsQuery } from '../hooks/use-material-models';
import type { MaterialModel } from '../model/material-model';

interface MaterialModelSelectItem {
  model: MaterialModel;
}

export type MaterialModelSelectProps = Omit<
  OptionSelectProps<MaterialModelSelectItem>,
  | 'options'
  | 'selectedOption'
  | 'renderOption'
  | 'optionContentClassName'
  | 'loading'
  | 'loadingMessage'
  | 'emptyMessage'
> & {
  sourceMode?: 'fetch' | 'options';
  models?: readonly MaterialModel[];
  selectedModel?: MaterialModel;
};

function modelOption(
  model: MaterialModel,
): SelectOption<MaterialModelSelectItem> {
  return {
    value: model.id,
    label: model.name,
    searchableText: `${model.name} ${model.code} ${(model.externalCodes ?? []).join(' ')}`,
    data: { model },
  };
}

function MaterialModelImage({ model }: MaterialModelSelectItem) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
      {model.imageUrl ? (
        <img src={model.imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <ImageIcon
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
      )}
    </span>
  );
}

function MaterialModelOption({
  model,
  showImage,
}: MaterialModelSelectItem & { showImage: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-start">
      {showImage ? <MaterialModelImage model={model} /> : null}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="block truncate text-sm font-medium text-foreground">
          {model.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {model.code}
        </span>
      </span>
    </span>
  );
}

function MaterialModelTrigger({
  model,
  showImage,
}: MaterialModelSelectItem & { showImage: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-start">
      {showImage ? <MaterialModelImage model={model} /> : null}
      <span className="block min-w-0 truncate">{model.name}</span>
    </span>
  );
}

export function MaterialModelSelect({
  value = '',
  placeholder,
  onOpenChange,
  sourceMode = 'fetch',
  models,
  selectedModel,
  ...props
}: MaterialModelSelectProps) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const showImage = props.size !== 'sm';
  const shouldFetch = sourceMode === 'fetch';
  const query = useMaterialModelsQuery(
    shouldFetch && !props.disabled && (open || Boolean(value)),
  );
  const selectPlaceholder =
    placeholder ??
    intl.formatMessage({ id: 'materialModels.select.placeholder' });
  const options = useMemo(() => {
    const source =
      sourceMode === 'options' ? (models ?? []) : (query.data ?? []);
    return source.filter((model) => model.isActive).map(modelOption);
  }, [models, query.data, sourceMode]);
  const selectedOption =
    options.find((option) => option.value === value) ??
    (selectedModel?.id === value ? modelOption(selectedModel) : undefined);

  return (
    <OptionSelect
      {...props}
      value={value}
      options={options}
      selectedOption={selectedOption}
      placeholder={selectPlaceholder}
      searchPlaceholder={intl.formatMessage({
        id: 'materialModels.filters.searchPlaceholder',
      })}
      emptyMessage={intl.formatMessage({ id: 'materialModels.empty.search' })}
      loading={shouldFetch && query.isPending && query.isFetching}
      loadingMessage={intl.formatMessage({ id: 'common.state.loading' })}
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
      canDeselect={false}
      optionContentClassName="whitespace-normal"
      triggerContentClassName="overflow-hidden"
      renderOption={(option) =>
        option.data ? (
          <MaterialModelOption
            model={option.data.model}
            showImage={showImage}
          />
        ) : (
          option.label
        )
      }
      triggerContent={(option) =>
        option?.data ? (
          <MaterialModelTrigger
            model={option.data.model}
            showImage={showImage}
          />
        ) : (
          <span className="truncate text-muted-foreground">
            {selectPlaceholder}
          </span>
        )
      }
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        onOpenChange?.(nextOpen);
      }}
    />
  );
}
