import { OptionSelect } from '@/components/ui/option-select';
import type { OptionSelectProps } from '@/components/ui/option-select';
import { MaterialSpecificationDataTypeIcon } from '../components/material-specification-data-type-icon';
import type { MaterialSpecificationDataType } from '../model/material-specification';

function renderDataTypeOption(
  option: NonNullable<OptionSelectProps['options']>[number] | undefined,
) {
  if (!option) return undefined;

  return (
    <span className="flex min-w-0 items-center gap-2">
      <MaterialSpecificationDataTypeIcon
        dataType={option.value as MaterialSpecificationDataType}
      />
      <span className="truncate">{option.label}</span>
    </span>
  );
}

export function MaterialSpecificationDataTypeSelect(props: OptionSelectProps) {
  return (
    <OptionSelect
      {...props}
      triggerContent={renderDataTypeOption}
      renderOption={renderDataTypeOption}
    />
  );
}
