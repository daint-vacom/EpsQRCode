import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { useUser } from '@/providers/user-provider';
import type {
  ApiOptionSelectProps,
  SelectOption,
} from '@/components/ui/option-select';
import { ApiOptionSelect, OptionSelect } from '@/components/ui/option-select';
import { SelectOptionContent } from '@/components/ui/select-option-content';
import { loadEpsOwnerEmployees } from '../api/custodians.api';
import type { EpsEmployeeCatalogEntry } from '../model/custodian';

type EmployeeFilters = { departmentId?: string; teamId?: string };

type EpsEmployeeSelectProps = Omit<
  ApiOptionSelectProps<EpsEmployeeCatalogEntry, EmployeeFilters>,
  | 'loadOptions'
  | 'cacheKey'
  | 'filters'
  | 'enabled'
  | 'pageSize'
  | 'loadingMessage'
  | 'loadingMoreMessage'
  | 'emptyMessage'
  | 'errorMessage'
  | 'retryLabel'
  | 'loadMoreLabel'
  | 'minSearchMessage'
> & {
  sourceMode?: 'fetch' | 'options';
  employees?: readonly EpsEmployeeCatalogEntry[];
  departmentId?: string;
  teamId?: string;
  enabled?: boolean;
};

function toOption(
  employee: EpsEmployeeCatalogEntry,
): SelectOption<EpsEmployeeCatalogEntry> {
  return {
    value: employee.id,
    label: employee.name,
    searchableText: `${employee.name} ${employee.code} ${employee.departmentName} ${employee.teamName ?? ''}`,
    data: employee,
  };
}

export function EpsEmployeeSelect({
  sourceMode = 'fetch',
  employees,
  departmentId,
  teamId,
  enabled = true,
  value = '',
  selectedOption,
  placeholder,
  ...props
}: EpsEmployeeSelectProps) {
  const intl = useIntl();
  const { userId } = useUser();
  const options = useMemo(
    () =>
      (employees ?? [])
        .filter(
          (employee) =>
            (!departmentId || employee.departmentId === departmentId) &&
            (!teamId || employee.teamId === teamId),
        )
        .map(toOption),
    [departmentId, employees, teamId],
  );
  const prompt =
    placeholder ??
    intl.formatMessage({ id: 'custodians.select.epsEmployee.placeholder' });
  const renderOption = (option: SelectOption<EpsEmployeeCatalogEntry>) =>
    option.data ? (
      <SelectOptionContent
        title={option.data.name}
        description={option.data.code}
      />
    ) : (
      option.label
    );

  if (sourceMode === 'options') {
    return (
      <OptionSelect
        {...props}
        value={value}
        options={options}
        selectedOption={
          options.find((option) => option.value === value) ?? selectedOption
        }
        placeholder={prompt}
        searchPlaceholder={intl.formatMessage({
          id: 'custodians.select.search',
        })}
        emptyMessage={intl.formatMessage({ id: 'custodians.select.empty' })}
        canDeselect={false}
        optionContentClassName="overflow-visible whitespace-normal"
        renderOption={renderOption}
      />
    );
  }

  return (
    <ApiOptionSelect<EpsEmployeeCatalogEntry, EmployeeFilters>
      {...props}
      value={value}
      selectedOption={selectedOption}
      placeholder={prompt}
      searchPlaceholder={intl.formatMessage({ id: 'custodians.select.search' })}
      loadOptions={async ({ search, filters, page, pageSize, signal }) => {
        const result = await loadEpsOwnerEmployees(
          { search, ...filters, page, pageSize },
          signal,
        );
        return {
          options: result.items.map(toOption),
          hasMore: page * pageSize < result.total,
        };
      }}
      cacheKey={['project', 'custodians', 'eps-employees', userId]}
      filters={{ departmentId, teamId }}
      enabled={enabled}
      pageSize={30}
      loadingMessage={intl.formatMessage({ id: 'common.state.loading' })}
      emptyMessage={intl.formatMessage({ id: 'custodians.select.empty' })}
      renderOption={renderOption}
      optionContentClassName="overflow-visible whitespace-normal"
    />
  );
}
