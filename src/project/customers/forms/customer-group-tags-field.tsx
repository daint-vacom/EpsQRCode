import { TagSelect } from '@/project/tags/components/tag-select';

interface CustomerGroupTagsFieldProps {
  value: string[];
  onChange: (tagIds: string[]) => void;
}

export function CustomerGroupTagsField({
  value,
  onChange,
}: CustomerGroupTagsFieldProps) {
  return (
    <TagSelect
      value={value}
      onChange={onChange}
      moduleCodes={['customers']}
      allowCustomGroups
      variant="button"
      placeholder="Thêm nhãn"
      searchPlaceholder="Tìm nhãn khách hàng..."
      emptyMessage="Không tìm thấy nhãn phù hợp."
      emptySelectionMessage="Chưa có nhãn nào."
      ariaLabel="Thêm nhãn khách hàng"
    />
  );
}
