import { useMemo } from 'react';
import {
  EpsTeamSelect,
  EpsUnitSelect,
  ExternalOrganizationSelect,
} from '@/project/custodians/components/custodian-catalog-selects';
import { EpsEmployeeSelect as EpsEmployeeSelector } from '@/project/custodians/components/eps-employee-select';
import type { EpsEmployeeCatalogEntry } from '@/project/custodians/model/custodian';
import { WarehouseSelect } from '@/project/warehouses/components/warehouse-select';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { OptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
import type {
  MaterialSafetyInspectionQueueOwnerFilter,
  MaterialSafetyInspectionQueueOwnerFilterType,
  MaterialSafetyInspectionQueueRow,
  MaterialSafetyInspectionQueueSummary,
} from '../model/safety-inspection';
import { MaterialSafetyInspectionQueueFilterViewSwitcher } from './material-safety-inspection-queue-filter-view-switcher.generated';

export type MaterialSafetyInspectionQueueFilterMode = 'status' | 'owner';
export type MaterialSafetyInspectionQueueOwnerType =
  MaterialSafetyInspectionQueueOwnerFilterType;

const OWNER_TYPE_OPTION_IDS: Record<
  MaterialSafetyInspectionQueueOwnerType,
  string
> = {
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
    searchableText: `${employee.name} ${employee.code} ${employee.departmentName} ${employee.teamName ?? ''}`,
    data: employee,
  };
}

export interface MaterialSafetyInspectionQueueFilterRowProps {
  mode: MaterialSafetyInspectionQueueFilterMode;
  onModeChange: (mode: MaterialSafetyInspectionQueueFilterMode) => void;
  status?: MaterialSafetyInspectionQueueRow['status'];
  onStatusChange: (status?: MaterialSafetyInspectionQueueRow['status']) => void;
  summary?: MaterialSafetyInspectionQueueSummary;
  isCountsLoading?: boolean;
  ownerFilter?: MaterialSafetyInspectionQueueOwnerFilter;
  ownerType: MaterialSafetyInspectionQueueOwnerType | '';
  onOwnerTypeChange: (
    type: MaterialSafetyInspectionQueueOwnerType | '',
  ) => void;
  ownerDepartmentId: string;
  onOwnerDepartmentChange: (departmentId: string) => void;
  ownerTeamId: string;
  onOwnerTeamChange: (teamId: string) => void;
  ownerPartyId: string;
  onOwnerPartyIdChange: (partyId: string) => void;
  selectedEmployee: EpsEmployeeCatalogEntry | null;
  onSelectedEmployeeChange: (employee: EpsEmployeeCatalogEntry | null) => void;
  disabled?: boolean;
}

export function MaterialSafetyInspectionQueueFilterRow({
  mode,
  onModeChange,
  status,
  onStatusChange,
  summary,
  isCountsLoading = false,
  ownerFilter,
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
  disabled = false,
}: MaterialSafetyInspectionQueueFilterRowProps) {
  const intl = useIntl();
  const modeOptions = useMemo(
    () =>
      [
        ['status', 'project.materials.filters.view.status'],
        ['owner', 'project.materials.filters.view.owner'],
      ].map(([value, id]) => ({
        value,
        label: intl.formatMessage({ id }),
      })),
    [intl],
  );
  const ownerTypeOptions = useMemo<SelectOption[]>(
    () =>
      Object.entries(OWNER_TYPE_OPTION_IDS)
        .filter(([value]) =>
          ownerFilter?.types.includes(
            value as MaterialSafetyInspectionQueueOwnerType,
          ),
        )
        .map(([value, id]) => ({
          value,
          label: intl.formatMessage({ id }),
        })),
    [intl, ownerFilter?.types],
  );
  const ownerTypeLabel = ownerType
    ? intl.formatMessage({ id: OWNER_TYPE_OPTION_IDS[ownerType] })
    : '';
  const countLabel = (count: number | undefined, selected: boolean) => (
    <span
      className={
        selected ? 'text-primary-foreground/80' : 'text-muted-foreground'
      }
    >
      {isCountsLoading || count === undefined ? '—' : intl.formatNumber(count)}
    </span>
  );

  const inspectionStatuses = [
    {
      value: 'due',
      label: intl.formatMessage({
        id: 'project.materials.safetyInspection.queue.status.due',
      }),
      count: summary?.due,
    },
    {
      value: 'upcoming',
      label: intl.formatMessage({
        id: 'project.materials.safetyInspection.queue.status.upcoming',
      }),
      count: summary?.upcoming,
    },
    {
      value: 'in_progress',
      label: intl.formatMessage({
        id: 'project.materials.safetyInspection.queue.status.inProgress',
      }),
      count: summary?.inProgress,
    },
  ] as const;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <MaterialSafetyInspectionQueueFilterViewSwitcher
        value={mode}
        onValueChange={(value) =>
          onModeChange(value as MaterialSafetyInspectionQueueFilterMode)
        }
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
            variant={status === undefined ? 'primary' : 'light-neutral'}
            size="md"
            className="shrink-0 rounded-full"
            onClick={() => onStatusChange(undefined)}
            disabled={disabled}
            aria-pressed={status === undefined}
          >
            {intl.formatMessage({ id: 'project.materials.filters.all' })}
            {countLabel(summary?.total, status === undefined)}
          </Button>
          {inspectionStatuses.map((option) => {
            const selected = status === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                variant={selected ? 'primary' : 'light-neutral'}
                size="md"
                className="shrink-0 rounded-full"
                onClick={() => onStatusChange(option.value)}
                disabled={disabled}
                aria-pressed={selected}
              >
                {option.label}
                {countLabel(option.count, selected)}
              </Button>
            );
          })}
        </div>
      ) : (
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
            onChange={(value) =>
              onOwnerTypeChange(
                value as MaterialSafetyInspectionQueueOwnerType | '',
              )
            }
            canDeselect
            searchable={false}
            disabled={
              disabled || !ownerFilter || ownerFilter.types.length === 0
            }
            className="w-48 shrink-0"
          />
          {ownerType === 'department' ? (
            <>
              <EpsUnitSelect
                aria-label={ownerTypeLabel}
                sourceMode="fetch"
                value={ownerDepartmentId}
                onChange={onOwnerDepartmentChange}
                canDeselect
                disabled={disabled || !ownerType}
                searchable
                className="w-64 shrink-0"
              />
              <EpsTeamSelect
                aria-label={intl.formatMessage({
                  id: 'project.handover.partyDialog.epsTeam',
                })}
                sourceMode="fetch"
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
              sourceMode="fetch"
              departmentId={ownerFilter?.departmentId ?? undefined}
              value={ownerPartyId}
              onChange={onOwnerPartyIdChange}
              canDeselect
              disabled={disabled || !ownerFilter?.departmentId}
              searchable
              className="w-64 shrink-0"
            />
          ) : null}
          {ownerType === 'person' ? (
            <EpsEmployeeSelector
              aria-label={ownerTypeLabel}
              value={ownerPartyId}
              departmentId={ownerFilter?.departmentId ?? undefined}
              teamId={ownerFilter?.teamId ?? undefined}
              accessMode="view"
              selectedOption={
                selectedEmployee
                  ? toEmployeeOption(selectedEmployee)
                  : undefined
              }
              onChange={onOwnerPartyIdChange}
              onSelect={(option) =>
                onSelectedEmployeeChange(option?.data ?? null)
              }
              canDeselect
              disabled={disabled}
              searchable
              className="w-64 shrink-0"
            />
          ) : null}
          {ownerType === 'warehouse' ? (
            <WarehouseSelect
              aria-label={ownerTypeLabel}
              value={ownerPartyId}
              onChange={onOwnerPartyIdChange}
              canDeselect
              disabled={disabled}
              searchable
              className="w-64 shrink-0"
            />
          ) : null}
          {ownerType === 'external' ? (
            <ExternalOrganizationSelect
              aria-label={ownerTypeLabel}
              sourceMode="fetch"
              value={ownerPartyId}
              onChange={onOwnerPartyIdChange}
              canDeselect
              disabled={disabled}
              searchable
              className="w-64 shrink-0"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
