import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { useUser } from '@/providers/user-provider';
import { ApiOptionSelect, OptionSelect } from '@/components/ui/option-select';
import type {
  OptionSelectProps,
  SelectOption,
} from '@/components/ui/option-select';
import { loadMaterials } from '../api/materials.api';
import { materialKeys, useMaterialQuery } from '../hooks/use-materials';
import type { Material, MaterialListFilters } from '../model/material';

interface MaterialSelectItem {
  material: Material;
}

type MaterialSelectBaseProps = Omit<
  OptionSelectProps<MaterialSelectItem>,
  | 'options'
  | 'selectedOption'
  | 'loading'
  | 'loadingMessage'
  | 'onSearchChange'
  | 'onSelect'
  | 'manualFilter'
> & {
  selectedMaterial?: Material;
  onSelect?: (material: Material | undefined) => void;
};

export interface MaterialSelectProps extends MaterialSelectBaseProps {
  sourceMode?: 'fetch' | 'options';
  materials?: readonly Material[];
  filters?: Omit<MaterialListFilters, 'search' | 'page' | 'pageSize'>;
  initialSearch?: string;
  pageSize?: number;
  allowReservedByHandoverId?: string;
}

function materialOption(material: Material): SelectOption<MaterialSelectItem> {
  const name = material.nameOverride || material.modelSnapshot.name;
  const searchableText = [
    material.code,
    name,
    material.modelSnapshot.code,
    material.modelSnapshot.name,
    material.serialNumber,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    value: material.id,
    label: `${material.code} · ${name}`,
    searchableText,
    data: { material },
  };
}

function materialName(material: Material) {
  return material.nameOverride || material.modelSnapshot.name;
}

function renderMaterialOption(option: SelectOption<MaterialSelectItem>) {
  const material = option.data?.material;
  if (!material) return option.label;

  return (
    <span className="flex min-w-0 flex-col gap-0.5 text-start">
      <span className="block truncate text-sm font-medium text-foreground">
        {material.code} · {materialName(material)}
      </span>
      <span className="block truncate text-xs text-muted-foreground">
        {material.modelSnapshot.code}
        {material.serialNumber ? ` · ${material.serialNumber}` : ''}
      </span>
    </span>
  );
}

function normalizeMaterialSearch(value: string) {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const materialIndex = segments.findIndex((segment) => segment === 'vat-tu');
    if (materialIndex >= 0 && segments[materialIndex + 1])
      return segments[materialIndex + 1];
  } catch {
    // Search text and IDs are accepted as-is.
  }
  return value.trim();
}

function MaterialOptionsSelect({
  materials = [],
  selectedMaterial,
  value = '',
  onSelect,
  ...props
}: MaterialSelectBaseProps & { materials?: readonly Material[] }) {
  const intl = useIntl();
  const options = useMemo(() => materials.map(materialOption), [materials]);
  const selectedOption =
    options.find((option) => option.value === value) ??
    (selectedMaterial?.id === value
      ? materialOption(selectedMaterial)
      : undefined);

  return (
    <OptionSelect
      {...props}
      value={value}
      options={options}
      selectedOption={selectedOption}
      placeholder={
        props.placeholder ??
        intl.formatMessage({ id: 'project.materials.select.placeholder' })
      }
      searchPlaceholder={intl.formatMessage({
        id: 'project.materials.select.search',
      })}
      renderOption={renderMaterialOption}
      triggerContent={(option) =>
        option?.data?.material ? (
          <span className="truncate">
            {option.data.material.code} · {materialName(option.data.material)}
          </span>
        ) : (
          <span className="truncate text-muted-foreground">
            {props.placeholder ??
              intl.formatMessage({
                id: 'project.materials.select.placeholder',
              })}
          </span>
        )
      }
      onSelect={(option) => onSelect?.(option?.data?.material)}
    />
  );
}

function MaterialFetchSelect({
  filters = {},
  selectedMaterial,
  value = '',
  pageSize = 30,
  initialSearch = '',
  allowReservedByHandoverId,
  onSelect,
  ...props
}: MaterialSelectBaseProps & {
  filters?: Omit<MaterialListFilters, 'search' | 'page' | 'pageSize'>;
  initialSearch?: string;
  pageSize?: number;
  allowReservedByHandoverId?: string;
}) {
  const intl = useIntl();
  const { userId } = useUser();
  const selectedQuery = useMaterialQuery(
    selectedMaterial?.id === value ? '' : value,
    !selectedMaterial || selectedMaterial.id !== value,
  );
  const selected =
    selectedMaterial?.id === value ? selectedMaterial : selectedQuery.data;
  const selectedOption = selected ? materialOption(selected) : undefined;
  return (
    <ApiOptionSelect<
      MaterialSelectItem,
      Omit<MaterialListFilters, 'search' | 'page' | 'pageSize'>
    >
      {...props}
      value={value}
      cacheKey={[...materialKeys.all, 'select', userId]}
      filters={{ ...filters, excludeReserved: true, allowReservedByHandoverId }}
      loadOptions={async ({
        search,
        filters: requestFilters,
        page,
        pageSize: size,
        signal,
      }) => {
        const normalized = normalizeMaterialSearch(search);
        const isId =
          /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
            normalized,
          );
        const result = await loadMaterials(
          {
            ...requestFilters,
            id: isId ? normalized : undefined,
            search: isId ? undefined : normalized || undefined,
            page,
            pageSize: size,
          },
          signal,
        );
        return {
          options: result.items.map(materialOption),
          hasMore: result.page * result.pageSize < result.total,
        };
      }}
      initialQuery={initialSearch}
      pageSize={pageSize}
      selectedOption={selectedOption}
      placeholder={
        props.placeholder ??
        intl.formatMessage({ id: 'project.materials.select.placeholder' })
      }
      searchPlaceholder={intl.formatMessage({
        id: 'project.materials.select.search',
      })}
      renderOption={renderMaterialOption}
      triggerContent={(option) =>
        option?.data?.material ? (
          <span className="truncate">
            {option.data.material.code} · {materialName(option.data.material)}
          </span>
        ) : (
          <span className="truncate text-muted-foreground">
            {props.placeholder ??
              intl.formatMessage({
                id: 'project.materials.select.placeholder',
              })}
          </span>
        )
      }
      onSelect={(option) => onSelect?.(option?.data?.material)}
      errorMessage={intl.formatMessage({
        id: 'project.materials.select.loadError',
      })}
    />
  );
}

export function MaterialSelect({
  sourceMode = 'fetch',
  materials,
  ...props
}: MaterialSelectProps) {
  if (sourceMode === 'options') {
    return <MaterialOptionsSelect {...props} materials={materials} />;
  }

  return <MaterialFetchSelect {...props} />;
}
