import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { Badge } from '@/components/ui/badge';
import { OptionSelect } from '@/components/ui/option-select';
import type {
  OptionSelectProps,
  SelectOption,
} from '@/components/ui/option-select';
import { SelectOptionContent } from '@/components/ui/select-option-content';
import { useMaterialLabelTemplatesQuery } from '../hooks/use-material-label-templates';
import type { MaterialLabelTemplate } from '../model/material-label-template';

interface MaterialLabelTemplateSelectItem {
  template: MaterialLabelTemplate;
  description: string;
  sizeLabel: string;
}

export type MaterialLabelTemplateSelectProps = Omit<
  OptionSelectProps<MaterialLabelTemplateSelectItem>,
  | 'options'
  | 'selectedOption'
  | 'renderOption'
  | 'optionContentClassName'
  | 'loading'
  | 'loadingMessage'
  | 'emptyMessage'
> & {
  sourceMode?: 'fetch' | 'options';
  templates?: readonly MaterialLabelTemplate[];
  activeOnly?: boolean;
};

function toOption(
  template: MaterialLabelTemplate,
  fallbackDescription: string,
): SelectOption<MaterialLabelTemplateSelectItem> {
  const description = template.description?.trim() || fallbackDescription;
  const sizeLabel = `${template.widthMm}x${template.heightMm}`;

  return {
    value: template.id,
    label: template.name,
    searchableText: `${template.name} ${description} ${sizeLabel}`,
    data: { template, description, sizeLabel },
  };
}

function TemplateOptionContent({
  item,
}: {
  item: MaterialLabelTemplateSelectItem;
}) {
  return (
    <span className="flex w-full min-w-0 items-center justify-between gap-3 text-start">
      <SelectOptionContent
        className="flex-1"
        title={item.template.name}
        description={item.description}
      />
      <Badge variant="secondary" size="md" className="shrink-0">
        {item.sizeLabel}
      </Badge>
    </span>
  );
}

function TemplateTriggerContent({
  template,
}: {
  template: MaterialLabelTemplate;
}) {
  return <span className="block min-w-0 truncate">{template.name}</span>;
}

export function MaterialLabelTemplateSelect({
  value = '',
  placeholder,
  onOpenChange,
  sourceMode = 'fetch',
  templates,
  activeOnly = true,
  ...props
}: MaterialLabelTemplateSelectProps) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const shouldFetch = sourceMode === 'fetch';
  const query = useMaterialLabelTemplatesQuery(
    shouldFetch && !props.disabled && (open || Boolean(value)),
  );
  const selectPlaceholder =
    placeholder ??
    intl.formatMessage({
      id: 'project.materialLabels.select.templatePlaceholder',
    });
  const fallbackDescription = intl.formatMessage({
    id: 'project.materialLabels.select.noDescription',
  });
  const options = useMemo(() => {
    const source =
      sourceMode === 'options' ? (templates ?? []) : (query.data ?? []);
    return source
      .filter((template) => !activeOnly || template.isActive)
      .map((template) => toOption(template, fallbackDescription));
  }, [activeOnly, fallbackDescription, query.data, sourceMode, templates]);
  const selectedOption = options.find((option) => option.value === value);

  return (
    <OptionSelect
      {...props}
      value={value}
      options={options}
      selectedOption={selectedOption}
      placeholder={selectPlaceholder}
      searchPlaceholder={intl.formatMessage({
        id: 'project.materialLabels.select.searchTemplates',
      })}
      emptyMessage={intl.formatMessage({
        id: 'project.materialLabels.select.emptyTemplates',
      })}
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
          <TemplateOptionContent item={option.data} />
        ) : (
          option.label
        )
      }
      triggerContent={(option) =>
        option?.data ? (
          <TemplateTriggerContent template={option.data.template} />
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
