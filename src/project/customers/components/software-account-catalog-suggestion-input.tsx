import { forwardRef, useMemo, type ComponentProps } from 'react';
import type { SoftwareAccountCatalog } from '@/project/tags/model/software-account-catalog';
import {
  AutocompleteInput,
  type AutocompleteOption,
} from '@/components/ui/autocomplete-input';

type SoftwareAccountCatalogSuggestionInputProps = Omit<
  ComponentProps<typeof AutocompleteInput>,
  'options' | 'onOptionSelect'
> & {
  catalogs: SoftwareAccountCatalog[];
  onCatalogSelect: (catalog: SoftwareAccountCatalog) => void;
};

export const SoftwareAccountCatalogSuggestionInput = forwardRef<
  HTMLInputElement,
  SoftwareAccountCatalogSuggestionInputProps
>(function SoftwareAccountCatalogSuggestionInput(
  { catalogs, onCatalogSelect, ...props },
  ref,
) {
  const options = useMemo<AutocompleteOption[]>(
    () =>
      catalogs.map((catalog) => ({
        value: catalog.name,
        label: catalog.name,
        status: {
          label: catalog.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng',
          variant: catalog.isActive ? 'success' : 'secondary',
          appearance: 'light',
        },
      })),
    [catalogs],
  );

  return (
    <AutocompleteInput
      {...props}
      ref={ref}
      options={options}
      emptyMessage="Không có tài khoản phần mềm mẫu"
      onOptionSelect={(option) => {
        const catalog = catalogs.find((item) => item.name === option.value);
        if (catalog) onCatalogSelect(catalog);
      }}
    />
  );
});
