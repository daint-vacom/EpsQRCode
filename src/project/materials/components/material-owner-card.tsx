import type { ReactNode } from 'react';
import {
  EpsTeamSelect,
  EpsUnitSelect,
  ExternalOrganizationSelect,
} from '@/project/custodians/components/custodian-catalog-selects';
import { EpsEmployeeSelect } from '@/project/custodians/components/eps-employee-select';
import type { Custodian } from '@/project/custodians/model/custodian';
import type {
  MaterialOwnerKind,
  MaterialOwnerSnapshotDraft,
} from '@/project/materials/model/material';
import { WarehouseSelect } from '@/project/warehouses/components/warehouse-select';
import type { WarehouseSelectItem } from '@/project/warehouses/components/warehouse-select';
import { Building2 } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { MaterialFormSchemaValues } from '../forms/material-form.schema';

interface MaterialOwnerCardProps {
  form: UseFormReturn<MaterialFormSchemaValues>;
  parties: Custodian[];
  readOnly: boolean;
  partyLoadError?: string;
  onRetry?: () => void;
  emptyState?: ReactNode;
}

const emptySnapshot: MaterialOwnerSnapshotDraft = {
  kind: 'eps',
  code: '',
  name: '',
  representativeName: '',
  phone: '',
  email: '',
};

function kindForParty(party?: Custodian): MaterialOwnerKind {
  if (party?.type === 'external') return 'external';
  if (party?.type === 'warehouse') return 'warehouse';
  if (party?.type === 'other') return 'other';
  return 'eps';
}

export function MaterialOwnerCard({
  form,
  parties,
  readOnly,
  partyLoadError,
  onRetry,
  emptyState,
}: MaterialOwnerCardProps) {
  const intl = useIntl();
  const ownerPartyId = form.watch('ownerPartyId');
  const snapshot = form.watch('ownerSnapshot') ?? emptySnapshot;
  const selectedParty = parties.find((party) => party.id === ownerPartyId);
  const kind = selectedParty ? kindForParty(selectedParty) : snapshot.kind;
  const departments = parties.filter(
    (party) => party.type === 'department' && party.isActive,
  );
  const selectedDepartmentId =
    snapshot.departmentId ??
    (selectedParty?.type === 'department'
      ? selectedParty.id
      : (selectedParty?.parentId ?? ''));
  const teams = parties.filter(
    (party) =>
      party.type === 'team' &&
      party.isActive &&
      party.parentId === selectedDepartmentId,
  );
  const selectedTeamId =
    snapshot.teamId ??
    (selectedParty?.type === 'team'
      ? selectedParty.id
      : selectedParty?.type === 'person' &&
          selectedParty.parentId &&
          teams.some((team) => team.id === selectedParty.parentId)
        ? selectedParty.parentId
        : '');
  const externalParties = parties.filter(
    (party) => party.type === 'external' && party.isActive,
  );
  const warehouses = parties.filter(
    (party) => party.type === 'warehouse' && party.isActive,
  );
  const warehouseOptions: WarehouseSelectItem[] = warehouses.map((party) => ({
    id: party.id,
    code: party.code,
    name: party.name,
  }));

  const setSnapshot = (patch: Partial<MaterialOwnerSnapshotDraft>) => {
    form.setValue(
      'ownerSnapshot',
      { ...snapshot, ...patch },
      { shouldDirty: true, shouldValidate: true },
    );
  };
  const applyParty = (party: Custodian, nextKind: MaterialOwnerKind = kind) => {
    const department =
      party.type === 'department'
        ? party
        : party.type === 'team'
          ? parties.find((item) => item.id === party.parentId)
          : party.type === 'person'
            ? parties.find(
                (item) =>
                  item.type === 'department' &&
                  item.id ===
                    (parties.find(
                      (candidate) => candidate.id === party.parentId,
                    )?.parentId ?? party.parentId),
              )
            : undefined;
    const team =
      party.type === 'team'
        ? party
        : party.type === 'person'
          ? parties.find(
              (item) => item.type === 'team' && item.id === party.parentId,
            )
          : undefined;
    form.setValue('ownerPartyId', party.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setSnapshot({
      kind: nextKind,
      code: party.code,
      name: party.name,
      representativeName:
        party.representativeName ?? party.representativeDisplayName ?? '',
      phone: party.phone ?? '',
      email: party.email ?? '',
      departmentId: department?.id ?? null,
      teamId: team?.id ?? null,
      employeeId: party.type === 'person' ? party.id : null,
      scopePartyId: party.isHandoverCustom
        ? (party.handoverScopePartyId ?? null)
        : null,
    });
  };
  const clearParty = (nextKind: MaterialOwnerKind) => {
    form.setValue('ownerPartyId', '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    const scopeParty = parties.find(
      (party) =>
        party.canManageMaterial &&
        ['department', 'team', 'person'].includes(party.type),
    );
    form.setValue(
      'ownerSnapshot',
      {
        ...emptySnapshot,
        kind: nextKind,
        scopePartyId: nextKind === 'other' ? (scopeParty?.id ?? null) : null,
      },
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const field = (
    name: keyof MaterialOwnerSnapshotDraft,
    labelId: string,
    required = false,
  ) => (
    <FormField
      key={name}
      control={form.control}
      name={
        `ownerSnapshot.${name}` as `ownerSnapshot.${keyof MaterialOwnerSnapshotDraft}`
      }
      render={({ field: input }) => (
        <FormItem layout="horizontal" labelWidth="md">
          <FormLabel>
            {intl.formatMessage({ id: labelId })}
            {required && !readOnly ? (
              <span className="text-destructive"> *</span>
            ) : null}
          </FormLabel>
          <FormControl>
            {name === 'code' && kind !== 'other' ? (
              <div className="flex min-h-9 items-center text-sm text-foreground">
                {input.value || '—'}
              </div>
            ) : (
              <Input {...input} value={input.value ?? ''} disabled={readOnly} />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Card className="min-w-0">
      <CardHeader className="min-h-0 px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4 text-primary" aria-hidden="true" />
          {intl.formatMessage({ id: 'project.materials.sections.owner' })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-5 pt-1">
        {partyLoadError ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materials.errors.loadCustodiansTitle',
            })}
            description={partyLoadError}
            onRetry={onRetry}
          />
        ) : null}
        {emptyState}
        <Form {...form}>
          <FormField
            control={form.control}
            name="ownerPartyId"
            render={() => (
              <div className="space-y-5">
                <FormItem layout="horizontal" labelWidth="md" alignment="start">
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'project.handover.partyDialog.kind',
                    })}
                  </FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={kind}
                      onValueChange={(value) =>
                        clearParty(value as MaterialOwnerKind)
                      }
                      disabled={readOnly}
                      className="grid gap-2 sm:grid-cols-4"
                    >
                      {(['eps', 'external', 'warehouse', 'other'] as const).map(
                        (option) => (
                          <label
                            key={option}
                            htmlFor={`material-owner-kind-${option}`}
                            className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <RadioGroupItem
                              id={`material-owner-kind-${option}`}
                              value={option}
                            />
                            {intl.formatMessage({
                              id: `project.handover.partyDialog.kind.${option}`,
                            })}
                          </label>
                        ),
                      )}
                    </RadioGroup>
                  </FormControl>
                </FormItem>

                {kind === 'eps' ? (
                  <>
                    <FormItem layout="horizontal" labelWidth="md">
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.materials.fields.epsUnit',
                        })}
                        <span className="text-destructive"> *</span>
                      </FormLabel>
                      <FormControl>
                        <EpsUnitSelect
                          sourceMode="options"
                          parties={parties}
                          value={selectedDepartmentId}
                          onChange={(value) => {
                            const party = departments.find(
                              (item) => item.id === value,
                            );
                            if (party) applyParty(party, 'eps');
                            else clearParty('eps');
                          }}
                          selectedOption={
                            selectedDepartmentId && snapshot.departmentName
                              ? {
                                  value: selectedDepartmentId,
                                  label: snapshot.departmentName,
                                }
                              : undefined
                          }
                          searchable
                          disabled={readOnly}
                        />
                      </FormControl>
                    </FormItem>
                    <FormItem layout="horizontal" labelWidth="md">
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.handover.partyDialog.epsTeam',
                        })}
                      </FormLabel>
                      <FormControl>
                        <EpsTeamSelect
                          sourceMode="options"
                          parties={parties}
                          departmentId={selectedDepartmentId}
                          value={selectedTeamId}
                          onChange={(value) => {
                            const party = teams.find(
                              (item) => item.id === value,
                            );
                            if (party) applyParty(party, 'eps');
                            else if (selectedDepartmentId) {
                              const department = departments.find(
                                (item) => item.id === selectedDepartmentId,
                              );
                              if (department) applyParty(department, 'eps');
                            }
                          }}
                          selectedOption={
                            selectedTeamId && snapshot.teamName
                              ? {
                                  value: selectedTeamId,
                                  label: snapshot.teamName,
                                }
                              : undefined
                          }
                          searchable
                          disabled={readOnly || !selectedDepartmentId}
                        />
                      </FormControl>
                    </FormItem>
                    <FormItem layout="horizontal" labelWidth="md">
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.handover.partyDialog.epsEmployee',
                        })}
                      </FormLabel>
                      <FormControl>
                        <EpsEmployeeSelect
                          value={
                            snapshot.employeeId ??
                            (selectedParty?.type === 'person'
                              ? selectedParty.id
                              : '')
                          }
                          onChange={(value) => {
                            if (!value) {
                              const parent = parties.find(
                                (item) =>
                                  item.id ===
                                  (selectedTeamId || selectedDepartmentId),
                              );
                              if (parent) applyParty(parent, 'eps');
                            }
                          }}
                          onSelect={(option) => {
                            const employee = option?.data;
                            if (!employee) return;
                            form.setValue('ownerPartyId', employee.id, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                            setSnapshot({
                              kind: 'eps',
                              departmentId: employee.departmentId,
                              teamId: employee.teamId,
                              employeeId: employee.id,
                              code: employee.code,
                              name: employee.name,
                              representativeName: '',
                              phone: '',
                              email: '',
                            });
                          }}
                          departmentId={selectedDepartmentId || undefined}
                          teamId={selectedTeamId || undefined}
                          selectedOption={
                            snapshot.employeeId && snapshot.name
                              ? {
                                  value: snapshot.employeeId,
                                  label: snapshot.name,
                                  data: {
                                    id: snapshot.employeeId,
                                    sourceId: '',
                                    code: snapshot.code,
                                    name: snapshot.name,
                                    departmentId: selectedDepartmentId,
                                    departmentName:
                                      snapshot.departmentName ?? '',
                                    teamId: selectedTeamId || null,
                                    teamName: snapshot.teamName ?? null,
                                  },
                                }
                              : undefined
                          }
                          disabled={readOnly || !selectedDepartmentId}
                        />
                      </FormControl>
                    </FormItem>
                  </>
                ) : null}

                {kind === 'external' || kind === 'warehouse' ? (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id:
                          kind === 'warehouse'
                            ? 'receipts.columns.warehouse'
                            : 'project.handover.partyDialog.catalogParty',
                      })}
                      <span className="text-destructive"> *</span>
                    </FormLabel>
                    <FormControl>
                      {kind === 'warehouse' ? (
                        <WarehouseSelect
                          sourceMode="options"
                          warehouses={warehouseOptions}
                          value={ownerPartyId}
                          onChange={(value) => {
                            const warehouse = warehouses.find(
                              (item) => item.id === value,
                            );
                            if (warehouse) applyParty(warehouse, 'warehouse');
                          }}
                          selectedOption={
                            ownerPartyId && snapshot.name
                              ? { value: ownerPartyId, label: snapshot.name }
                              : undefined
                          }
                          disabled={readOnly}
                          searchable
                        />
                      ) : (
                        <ExternalOrganizationSelect
                          sourceMode="options"
                          parties={parties}
                          value={ownerPartyId}
                          onChange={(value) => {
                            const externalParty = externalParties.find(
                              (item) => item.id === value,
                            );
                            if (externalParty)
                              applyParty(externalParty, 'external');
                          }}
                          selectedOption={
                            ownerPartyId && snapshot.name
                              ? { value: ownerPartyId, label: snapshot.name }
                              : undefined
                          }
                          disabled={readOnly}
                          searchable
                        />
                      )}
                    </FormControl>
                  </FormItem>
                ) : null}

                <div className="space-y-5 border-t border-border pt-5">
                  {field('code', 'project.handover.custodians.fields.code')}
                  {field(
                    'name',
                    'project.handover.custodians.fields.name',
                    true,
                  )}
                  {field(
                    'representativeName',
                    'project.handover.fields.representative',
                  )}
                  {field('phone', 'project.handover.fields.phone')}
                  {field('email', 'project.handover.fields.email')}
                </div>
                <FormMessage />
              </div>
            )}
          />
        </Form>
      </CardContent>
    </Card>
  );
}
