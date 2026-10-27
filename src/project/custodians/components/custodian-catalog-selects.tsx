import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { OptionSelect } from '@/components/ui/option-select';
import type {
  OptionSelectProps,
  SelectOption,
} from '@/components/ui/option-select';
import { SelectOptionContent } from '@/components/ui/select-option-content';
import { useCustodiansQuery } from '../hooks/use-custodians';
import type { Custodian } from '../model/custodian';

type CatalogKind = 'department' | 'team' | 'external';

type CustodianCatalogSelectProps = Omit<
  OptionSelectProps<Custodian>,
  | 'options'
  | 'renderOption'
  | 'loading'
  | 'loadingMessage'
  | 'emptyMessage'
  | 'errorMessage'
  | 'onRetry'
  | 'retryLabel'
  | 'optionContentClassName'
> & {
  sourceMode?: 'fetch' | 'options';
  parties?: readonly Custodian[];
  selectedOption?: SelectOption<Custodian>;
};

interface InternalCustodianSelectProps extends CustodianCatalogSelectProps {
  kind: CatalogKind;
  departmentId?: string;
}

function CustodianCatalogSelect({
  kind,
  departmentId,
  value = '',
  placeholder,
  onOpenChange,
  sourceMode = 'fetch',
  parties,
  selectedOption,
  ...props
}: InternalCustodianSelectProps) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const shouldFetch = sourceMode === 'fetch';
  const query = useCustodiansQuery(
    false,
    shouldFetch && !props.disabled && (open || Boolean(value)),
  );
  const options = useMemo<SelectOption<Custodian>[]>(() => {
    const source =
      sourceMode === 'options' ? (parties ?? []) : (query.data ?? []);
    return source
      .filter((party) => {
        if (!party.isActive) return false;
        if (kind === 'department') return party.type === 'department';
        if (kind === 'team')
          return (
            party.type === 'team' &&
            (!departmentId || party.parentId === departmentId)
          );
        return party.type === 'external';
      })
      .map((party) => ({
        value: party.id,
        label: party.name,
        searchableText: `${party.name} ${party.code}`,
        data: party,
      }));
  }, [departmentId, kind, parties, query.data, sourceMode]);
  const placeholderId =
    kind === 'department'
      ? 'custodians.select.epsUnit.placeholder'
      : kind === 'team'
        ? 'custodians.select.epsTeam.placeholder'
        : 'custodians.select.externalOrganization.placeholder';
  const prompt = placeholder ?? intl.formatMessage({ id: placeholderId });

  return (
    <OptionSelect
      {...props}
      value={value}
      options={options}
      selectedOption={
        options.find((option) => option.value === value) ?? selectedOption
      }
      placeholder={prompt}
      searchPlaceholder={intl.formatMessage({ id: 'custodians.select.search' })}
      loading={shouldFetch && query.isPending && query.isFetching}
      loadingMessage={intl.formatMessage({ id: 'common.state.loading' })}
      errorMessage={
        shouldFetch && query.isError
          ? getApiErrorMessage(query.error)
          : undefined
      }
      retryLabel={intl.formatMessage({ id: 'common.actions.retry' })}
      onRetry={() => {
        if (shouldFetch && !query.isFetching)
          void query.refetch({ cancelRefetch: false });
      }}
      emptyMessage={
        shouldFetch && query.isError
          ? getApiErrorMessage(query.error)
          : intl.formatMessage({ id: 'custodians.select.empty' })
      }
      canDeselect={false}
      optionContentClassName="overflow-visible whitespace-normal"
      renderOption={(option) =>
        option.data ? (
          <SelectOptionContent
            title={option.data.name}
            description={option.data.code}
          />
        ) : (
          option.label
        )
      }
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        onOpenChange?.(nextOpen);
      }}
    />
  );
}

export type EpsUnitSelectProps = CustodianCatalogSelectProps;

export function EpsUnitSelect(props: EpsUnitSelectProps) {
  return <CustodianCatalogSelect {...props} kind="department" />;
}

export type EpsTeamSelectProps = CustodianCatalogSelectProps & {
  departmentId?: string;
};

export function EpsTeamSelect({ departmentId, ...props }: EpsTeamSelectProps) {
  return (
    <CustodianCatalogSelect
      {...props}
      kind="team"
      departmentId={departmentId}
    />
  );
}

export type ExternalOrganizationSelectProps = CustodianCatalogSelectProps;

export function ExternalOrganizationSelect(
  props: ExternalOrganizationSelectProps,
) {
  return <CustodianCatalogSelect {...props} kind="external" />;
}
