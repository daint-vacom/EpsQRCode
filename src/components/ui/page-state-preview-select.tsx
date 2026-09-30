import { OptionSelect, type SelectOption } from '@/components/ui/option-select';

export type PageStatePreview = 'idle' | 'loading' | 'error';

const PAGE_STATE_PREVIEW_OPTIONS: SelectOption[] = [
  { value: 'idle', label: 'Idle' },
  { value: 'loading', label: 'Đang tải' },
  { value: 'error', label: 'Lỗi' },
];

export function PageStatePreviewSelect({
  value,
  onChange,
}: {
  value: PageStatePreview;
  onChange: (value: PageStatePreview) => void;
}) {
  return (
    <OptionSelect
      value={value}
      onChange={(nextValue) => {
        if (
          nextValue === 'idle' ||
          nextValue === 'loading' ||
          nextValue === 'error'
        ) {
          onChange(nextValue);
        }
      }}
      options={PAGE_STATE_PREVIEW_OPTIONS}
      searchable={false}
      canDeselect={false}
      ariaLabel="Chọn trạng thái xem trước trang"
      size="sm"
      className="w-32"
    />
  );
}
