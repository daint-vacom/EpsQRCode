import {
  OptionSelect,
  type OptionSelectProps,
} from '@/components/ui/option-select';
import {
  REPORT_PERIOD_OPTIONS,
  type ReportPeriodKey,
} from '../model/report-period';

export interface ReportPeriodSelectProps extends Omit<
  OptionSelectProps<ReportPeriodKey>,
  'options' | 'value' | 'onChange' | 'selectedOption'
> {
  value?: ReportPeriodKey;
  onChange: (value: ReportPeriodKey) => void;
}

export function ReportPeriodSelect({
  value,
  onChange,
  ariaLabel = 'Khoảng thời gian',
  placeholder = 'Chọn khoảng thời gian',
  searchable = false,
  ...props
}: ReportPeriodSelectProps) {
  return (
    <OptionSelect<ReportPeriodKey>
      {...props}
      value={value ?? ''}
      onChange={(nextValue) => {
        if (nextValue) onChange(nextValue as ReportPeriodKey);
      }}
      options={REPORT_PERIOD_OPTIONS.map((option) => ({
        value: option.key,
        label: option.label,
        group: option.group,
      }))}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      searchable={searchable}
      canDeselect={false}
    />
  );
}
