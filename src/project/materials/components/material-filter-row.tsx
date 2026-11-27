import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  EpsTeamSelect,
  EpsUnitSelect,
  ExternalOrganizationSelect,
} from '@/project/custodians/components/custodian-catalog-selects';
import { EpsEmployeeSelect } from '@/project/custodians/components/eps-employee-select';
import type {
  Custodian,
  EpsEmployeeCatalogEntry,
} from '@/project/custodians/model/custodian';
import { WarehouseSelect } from '@/project/warehouses/components/warehouse-select';
import type { WarehouseSelectItem } from '@/project/warehouses/components/warehouse-select';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { OptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
import type {
  MaterialCondition,
  MaterialFilterSummary,
  MaterialOwnerFilter,
  MaterialOwnerFilterType,
} from '../model/material';
import { MaterialFilterViewSwitcher } from './material-filter-view-switcher.generated';

export const MATERIAL_FILTER_MODES = ['status', 'condition', 'owner'] as const;

export type MaterialFilterMode = 'status' | 'condition' | 'owner' | 'scan';

const OWNER_TYPE_OPTION_IDS: Record<MaterialOwnerFilterType, string> = {
  department: 'project.materials.fields.epsUnit',
  team: 'project.handover.partyDialog.epsTeam',
  person: 'project.handover.partyDialog.epsEmployee',
  warehouse: 'receipts.columns.warehouse',
  external: 'project.handover.partyDialog.catalogParty',
};

function toEmployeeOption(employee: EpsEmployeeCatalogEntry) {
  return {
    value: employee.id,
    label: employee.name,
    searchableText: `${employee.name} ${employee.code}`,
    data: employee,
  };
}

export interface MaterialFilterRowProps {
  leadingAction?: ReactNode;
  mode: MaterialFilterMode;
  onModeChange: (mode: MaterialFilterMode) => void;
  counts?: MaterialFilterSummary;
  isCountsLoading?: boolean;
  ownerFilter?: MaterialOwnerFilter;
  availableModes?: readonly MaterialFilterMode[];
  isActive?: boolean;
  onIsActiveChange: (isActive?: boolean) => void;
  condition?: MaterialCondition;
  onConditionChange: (condition?: MaterialCondition) => void;
  scanState?: 'scanned' | 'not_scanned';
  onScanStateChange?: (state?: 'scanned' | 'not_scanned') => void;
  ownerType: MaterialOwnerFilterType | '';
  onOwnerTypeChange: (type: MaterialOwnerFilterType | '') => void;
  ownerDepartmentId: string;
  onOwnerDepartmentChange: (departmentId: string) => void;
  ownerTeamId: string;
  onOwnerTeamChange: (teamId: string) => void;
  ownerPartyId: string;
  onOwnerPartyIdChange: (partyId: string) => void;
  selectedEmployee: EpsEmployeeCatalogEntry | null;
  onSelectedEmployeeChange: (employee: EpsEmployeeCatalogEntry | null) => void;
  parties: readonly Custodian[];
  disabled?: boolean;
}

export function MaterialFilterRow({
  leadingAction,
  mode,
  onModeChange,
  counts = {},
  isCountsLoading = false,
  ownerFilter,
  availableModes = MATERIAL_FILTER_MODES,
  isActive,
  onIsActiveChange,
  condition,
  onConditionChange,
  scanState,
  onScanStateChange = () => undefined,
  ownerType,
  onOwnerTypeChange,
  ownerDepartmentId,
  onOwnerDepartmentChange,
  ownerTeamId,
  onOwnerTeamChange,
  ownerPartyId,
  onOwnerPartyIdChange,
  selectedEmployee,
  onSelectedEmployeeChange,
  parties,
  disabled = false,
}: MaterialFilterRowProps) {
  const intl = useIntl();
  const modeOptions = useMemo(
    () =>
      availableModes.map((value) => ({
        value,
        label: intl.formatMessage({
          id:
            value === 'scan'
              ? 'project.management.filters.scan'
              : 'project.materials.filters.view.' + value,
        }),
      })),
    [availableModes, intl],
  );
  const ownerTypeOptions = useMemo<SelectOption[]>(
    () =>
      Object.entries(OWNER_TYPE_OPTION_IDS)
        .filter(([value]) =>
          ownerFilter?.types.includes(value as MaterialOwnerFilterType),
        )
        .map(([value, id]) => ({
          value,
          label: intl.formatMessage({ id }),
        })),
    [intl, ownerFilter?.types],
  );
  const warehouseOptions = useMemo<WarehouseSelectItem[]>(
    () =>
      parties
        .filter((party) => party.type === 'warehouse' && party.isActive)
        .map(({ id, code, name }) => ({ id, code, name })),
    [parties],
  );
  const ownerTypeLabel = ownerType
    ? intl.formatMessage({ id: OWNER_TYPE_OPTION_IDS[ownerType] })
    : '';
  const secondSelectDisabled = disabled || !ownerType;
  const countLabel = (count: number | undefined, selected: boolean) => (
    <span
      className={
        selected ? 'text-primary-foreground/80' : 'text-muted-foreground'
      }
    >
      {isCountsLoading || count === undefined ? '—' : intl.formatNumber(count)}
    </span>
  );

  function updateOwnerType(value: string) {
    onOwnerTypeChange(value as MaterialOwnerFilterType | '');
    onOwnerDepartmentChange('');
    onOwnerTeamChange('');
    onOwnerPartyIdChange('');
    onSelectedEmployeeChange(null);
  }

  function updateOwnerParty(partyId: string) {
    onOwnerPartyIdChange(partyId);
    if (ownerType !== 'person') onSelectedEmployeeChange(null);
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {leadingAction}
      <MaterialFilterViewSwitcher
        value={mode}
        onValueChange={(value) => onModeChange(value as MaterialFilterMode)}
        options={modeOptions}
        disabled={disabled}
        className="shrink-0"
      />
      <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

      {mode === 'status' ? (
        <div
          role="group"
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={intl.formatMessage({
            id: 'project.materials.filters.view.status',
          })}
        >
          <Button
            type="button"
            variant={isActive === undefined ? 'primary' : 'light-neutral'}
            size="md"
            className="shrink-0 rounded-full"
            onClick={() => onIsActiveChange(undefined)}
            disabled={disabled}
            aria-pressed={isActive === undefined}
          >
            {intl.formatMessage({ id: 'project.materials.filters.all' })}
            {countLabel(counts.total, isActive === undefined)}
          </Button>
          {([true, false] as const).map((value) => {
            const label = intl.formatMessage({
              id:
                value === true
                  ? 'project.materials.filters.inUse'
                  : 'project.materials.filters.notInUse',
            });
            const selected = isActive === value;
            const count = value ? counts.active : counts.inactive;
            return (
              <Button
                key={String(value)}
                type="button"
                variant={selected ? 'primary' : 'light-neutral'}
                size="md"
                className="shrink-0 rounded-full"
                onClick={() => onIsActiveChange(value)}
                disabled={disabled}
                aria-pressed={selected}
              >
                {label}
                {countLabel(count, selected)}
              </Button>
            );
          })}
        </div>
      ) : null}

      {mode === 'condition' ? (
        <div
          role="group"
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={intl.formatMessage({
            id: 'project.materials.filters.view.condition',
          })}
        >
          <Button
            type="button"
            variant={condition === undefined ? 'primary' : 'light-neutral'}
            size="md"
            className="shrink-0 rounded-full"
            onClick={() => onConditionChange(undefined)}
            disabled={disabled}
            aria-pressed={condition === undefined}
          >
            {intl.formatMessage({ id: 'project.materials.filters.all' })}
            {countLabel(counts.total, condition === undefined)}
          </Button>
          {(['good', 'damaged'] as const).map((value) => {
            const selected = condition === value;
            const count = value === 'good' ? counts.good : counts.damaged;
            return (
              <Button
                key={value}
                type="button"
                variant={selected ? 'primary' : 'light-neutral'}
                size="md"
                className="shrink-0 rounded-full"
                onClick={() => onConditionChange(value)}
                disabled={disabled}
                aria-pressed={selected}
              >
                {intl.formatMessage({
                  id: `project.materials.condition.${value}`,
                })}
                {countLabel(count, selected)}
              </Button>
            );
          })}
        </div>
      ) : null}

      {mode === 'scan' ? (
        <div
          role="group"
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={intl.formatMessage({
            id: 'project.management.filters.scan',
          })}
        >
          <Button
            type="button"
            variant={scanState === undefined ? 'primary' : 'light-neutral'}
            size="md"
            className="shrink-0 rounded-full"
            onClick={() => onScanStateChange(undefined)}
            disabled={disabled}
            aria-pressed={scanState === undefined}
          >
            {intl.formatMessage({ id: 'project.materials.filters.all' })}
            {countLabel(counts.qrTotal, scanState === undefined)}
          </Button>
          {(['scanned', 'not_scanned'] as const).map((value) => {
            const selected = scanState === value;
            const count =
              value === 'scanned' ? counts.qrScanned : counts.qrNotScanned;
            return (
              <Button
                key={value}
                type="button"
                variant={selected ? 'primary' : 'light-neutral'}
                size="md"
                className="shrink-0 rounded-full"
                onClick={() => onScanStateChange(value)}
                disabled={disabled}
                aria-pressed={selected}
              >
                {intl.formatMessage({
                  id: 'project.materialQrTracking.filters.' + value,
                })}
                {countLabel(count, selected)}
              </Button>
            );
          })}
        </div>
      ) : null}

      {mode === 'owner' ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <OptionSelect
            aria-label={intl.formatMessage({
              id: 'project.materials.filters.ownerType',
            })}
            placeholder={intl.formatMessage({
              id: 'project.materials.filters.ownerType',
            })}
            options={ownerTypeOptions}
            value={ownerType}
            onChange={updateOwnerType}
            canDeselect
            searchable={false}
            disabled={disabled || !ownerFilter}
            className="w-48 shrink-0"
          />
          {ownerType === 'department' ? (
            <>
              <EpsUnitSelect
                aria-label={ownerTypeLabel}
                sourceMode="options"
                parties={parties}
                value={ownerDepartmentId}
                onChange={onOwnerDepartmentChange}
                canDeselect
                disabled={secondSelectDisabled}
                searchable
                className="w-64 shrink-0"
              />
              <EpsTeamSelect
                aria-label={intl.formatMessage({
                  id: 'project.handover.partyDialog.epsTeam',
                })}
                sourceMode="options"
                parties={parties}
                departmentId={ownerDepartmentId || undefined}
                value={ownerTeamId}
                onChange={onOwnerTeamChange}
                canDeselect
                disabled={disabled || !ownerDepartmentId}
                searchable
                className="w-64 shrink-0"
              />
            </>
          ) : null}
          {ownerType === 'team' ? (
            <EpsTeamSelect
              aria-label={ownerTypeLabel}
              sourceMode="options"
              parties={parties}
              departmentId={ownerFilter?.departmentId ?? undefined}
              value={ownerTeamId}
              onChange={onOwnerTeamChange}
              canDeselect
              disabled={secondSelectDisabled || !ownerFilter?.departmentId}
              searchable
              className="w-64 shrink-0"
            />
          ) : null}
          {ownerType === 'person' ? (
            <EpsEmployeeSelect
              aria-label={ownerTypeLabel}
              accessMode="view"
              departmentId={ownerFilter?.departmentId ?? undefined}
              teamId={ownerFilter?.teamId ?? undefined}
              value={ownerPartyId}
              selectedOption={
                selectedEmployee
                  ? toEmployeeOption(selectedEmployee)
                  : undefined
              }
              onSelect={(option) => {
                const employee = option?.data ?? null;
                onSelectedEmployeeChange(employee);
                onOwnerPartyIdChange(employee?.id ?? '');
              }}
              disabled={secondSelectDisabled}
              enabled={!secondSelectDisabled}
              className="w-64 shrink-0"
            />
          ) : null}
          {ownerType === 'external' ? (
            <ExternalOrganizationSelect
              aria-label={ownerTypeLabel}
              sourceMode="options"
              parties={parties}
              value={ownerPartyId}
              onChange={updateOwnerParty}
              disabled={secondSelectDisabled}
              searchable
              className="w-64 shrink-0"
            />
          ) : null}
          {ownerType === 'warehouse' ? (
            <WarehouseSelect
              aria-label={ownerTypeLabel}
              sourceMode="options"
              warehouses={warehouseOptions}
              value={ownerPartyId}
              onChange={updateOwnerParty}
              disabled={secondSelectDisabled}
              searchable
              className="w-64 shrink-0"
            />
          ) : null}
          {!ownerType ? (
            <OptionSelect
              aria-label={intl.formatMessage({
                id: 'project.materials.filters.ownerSelect',
              })}
              placeholder={intl.formatMessage({
                id: 'project.materials.filters.ownerSelect',
              })}
              options={[]}
              value=""
              onChange={() => undefined}
              disabled
              className="w-64 shrink-0"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
