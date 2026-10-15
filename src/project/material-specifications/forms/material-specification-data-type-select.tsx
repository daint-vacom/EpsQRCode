import {
  CalendarDays,
  Hash,
  Palette,
  Ruler,
  Scale,
  ToggleLeft,
  Type,
} from 'lucide-react';
import { OptionSelect } from '@/components/ui/option-select';
import type { OptionSelectProps } from '@/components/ui/option-select';
import type { MaterialSpecificationDataType } from '../model/material-specification';

const dataTypeIcons = {
  text: Type,
  number: Hash,
  boolean: ToggleLeft,
  date: CalendarDays,
  color: Palette,
  length: Ruler,
  weight: Scale,
} satisfies Record<MaterialSpecificationDataType, typeof Type>;

function renderDataTypeOption(
  option: NonNullable<OptionSelectProps['options']>[number] | undefined,
) {
  if (!option) return undefined;

  const Icon = dataTypeIcons[option.value as MaterialSpecificationDataType];
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
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
