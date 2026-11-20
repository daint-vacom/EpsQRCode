import { CheckCircle2, CircleAlert } from 'lucide-react';
import { useIntl } from 'react-intl';
import { OptionSelect } from '@/components/ui/option-select';
import type { OptionSelectProps } from '@/components/ui/option-select';
import type { MaterialCondition } from '../model/material';

type MaterialConditionSelectProps = Omit<
  OptionSelectProps<MaterialCondition>,
  | 'options'
  | 'value'
  | 'onChange'
  | 'renderOption'
  | 'triggerContent'
  | 'searchable'
> & {
  value: MaterialCondition | '';
  onChange: (value: MaterialCondition | '') => void;
};

function ConditionLabel({
  condition,
  label,
}: {
  condition: MaterialCondition;
  label: string;
}) {
  const Icon = condition === 'good' ? CheckCircle2 : CircleAlert;
  const colorClass =
    condition === 'good' ? 'text-admin-success-text' : 'text-destructive';

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className={`size-4 shrink-0 ${colorClass}`} aria-hidden="true" />
      <span className={colorClass}>{label}</span>
    </span>
  );
}

export function MaterialConditionSelect({
  value,
  onChange,
  ...props
}: MaterialConditionSelectProps) {
  const intl = useIntl();
  const options = [
    {
      value: 'good' as const,
      label: intl.formatMessage({ id: 'project.materials.condition.good' }),
    },
    {
      value: 'damaged' as const,
      label: intl.formatMessage({ id: 'project.materials.condition.damaged' }),
    },
  ];
  const selected = options.find((option) => option.value === value);

  return (
    <OptionSelect<MaterialCondition>
      {...props}
      value={value}
      onChange={(nextValue) =>
        onChange(
          nextValue === 'good' || nextValue === 'damaged' ? nextValue : '',
        )
      }
      options={options}
      searchable={false}
      canDeselect={false}
      triggerContent={
        selected ? (
          <ConditionLabel condition={selected.value} label={selected.label} />
        ) : (
          intl.formatMessage({ id: 'project.materials.fields.condition' })
        )
      }
      renderOption={(option) => (
        <ConditionLabel condition={option.value} label={option.label} />
      )}
    />
  );
}
