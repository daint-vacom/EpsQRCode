import { useMemo } from 'react';
import { useUser } from '@/providers/user-provider';
import { ApiOptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
import { loadMaterialReceiptOptions } from '../api/material-receipts.api';
import { materialReceiptKeys } from '../hooks/use-material-receipts';
import type { MaterialReceiptSelectOption } from '../model/material-receipt';

export interface MaterialReceiptSelectProps {
  value: string;
  onSelect: (receipt: MaterialReceiptSelectOption | undefined) => void;
  selectedReceipt?: MaterialReceiptSelectOption;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  statuses?: MaterialReceiptSelectOption['status'][];
}

function receiptOption(
  receipt: MaterialReceiptSelectOption,
): SelectOption<{ receipt: MaterialReceiptSelectOption }> {
  return {
    value: receipt.id,
    label: receipt.code,
    searchableText: receipt.code,
    data: { receipt },
  };
}

export function MaterialReceiptSelect({
  value,
  onSelect,
  selectedReceipt,
  disabled,
  placeholder,
  ariaLabel,
  className,
  statuses,
}: MaterialReceiptSelectProps) {
  const { userId } = useUser();
  const selectedOption = useMemo(
    () =>
      selectedReceipt?.id === value
        ? receiptOption(selectedReceipt)
        : undefined,
    [selectedReceipt, value],
  );

  return (
    <ApiOptionSelect<
      { receipt: MaterialReceiptSelectOption },
      { statuses?: MaterialReceiptSelectOption['status'][] }
    >
      value={value}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      selectedOption={selectedOption}
      cacheKey={[...materialReceiptKeys.all, 'select', userId]}
      filters={{ statuses }}
      pageSize={25}
      loadOptions={async ({ search, filters, page, pageSize, signal }) => {
        const result = await loadMaterialReceiptOptions(
          { search, statuses: filters?.statuses, page, pageSize },
          signal,
        );
        return {
          options: result.items.map(receiptOption),
          total: result.total,
        };
      }}
      onSelect={(option) => onSelect(option?.data?.receipt)}
    />
  );
}
