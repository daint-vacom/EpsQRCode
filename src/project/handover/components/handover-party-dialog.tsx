import { useEffect, useMemo, useRef } from 'react';
import { loadEpsOwnerEmployees } from '@/project/custodians/api/custodians.api';
import type {
  Custodian,
  EpsEmployeeCatalogEntry,
} from '@/project/custodians/model/custodian';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { useUser } from '@/providers/user-provider';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ApiOptionSelect, OptionSelect } from '@/components/ui/option-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { HandoverFormValues, HandoverPartyKind } from '../model/handover';
import { HandoverPartyDialogShell } from './handover-party-dialog-shell.generated';

type Side = 'sender' | 'recipient';

type SideFieldNames = {
  PartyId: 'senderPartyId' | 'recipientPartyId';
  PartyKind: 'senderPartyKind' | 'recipientPartyKind';
  PartyCode: 'senderPartyCode' | 'recipientPartyCode';
  PartyName: 'senderPartyName' | 'recipientPartyName';
  PartyPhone: 'senderPartyPhone' | 'recipientPartyPhone';
  PartyEmail: 'senderPartyEmail' | 'recipientPartyEmail';
  RepresentativeName:
    | 'senderRepresentativeName'
    | 'recipientRepresentativeName';
  RepresentativeUserId:
    | 'senderRepresentativeUserId'
    | 'recipientRepresentativeUserId';
  PartyScopePartyId: 'senderPartyScopePartyId' | 'recipientPartyScopePartyId';
};

interface PartyDialogValues {
  kind: HandoverPartyKind;
  partyId: string;
  departmentId: string;
  teamId: string;
  personId: string;
  scopePartyId: string;
  code: string;
  name: string;
  representativeName: string;
  representativeUserId: string | null;
  phone: string;
  email: string;
}

interface PartyCatalogItem {
  id: string;
  type: Custodian['type'];
  code: string;
  name: string;
  parentId: string | null;
  representativeUserId: string | null;
  representativeDisplayName: string | null;
  representativeName: string | null;
  phone: string | null;
  email: string | null;
  isHandoverCustom: boolean;
  handoverScopePartyId: string | null;
  canRepresent: boolean;
  sourceType: Custodian['sourceType'];
  sourceId: string | null;
}

interface HandoverPartyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: Side;
  form: UseFormReturn<HandoverFormValues>;
  parties: Custodian[];
  selectionOnly?: boolean;
  initialPartyId?: string;
  allowedKinds?: readonly HandoverPartyKind[];
  onSelectPartyId?: (partyId: string) => void;
  disabled?: boolean;
}

function fieldName<K extends keyof SideFieldNames>(
  side: Side,
  key: K,
): SideFieldNames[K] {
  return `${side === 'sender' ? 'sender' : 'recipient'}${key}` as SideFieldNames[K];
}

function snapshotToKind(party?: {
  type: Custodian['type'];
  isHandoverCustom?: boolean;
}): HandoverPartyKind {
  if (party?.isHandoverCustom || party?.type === 'other') return 'other';
  if (party?.type === 'external') return 'external';
  if (party?.type === 'warehouse') return 'warehouse';
  return 'eps';
}

function mapParty(party: Custodian): PartyCatalogItem {
  const representativeDisplayName =
    'representativeDisplayName' in party
      ? party.representativeDisplayName
      : null;
  return {
    id: party.id,
    type: party.type,
    code: party.code,
    name: party.name,
    canRepresent: party.canRepresent,
    parentId: party.parentId,
    representativeUserId:
      'representativeUserId' in party ? party.representativeUserId : null,
    representativeDisplayName,
    representativeName: party.representativeName ?? representativeDisplayName,
    phone: party.phone ?? null,
    email: party.email ?? null,
    isHandoverCustom: Boolean(party.isHandoverCustom),
    handoverScopePartyId: party.handoverScopePartyId ?? null,
    sourceType: 'sourceType' in party ? (party.sourceType ?? null) : null,
    sourceId: 'sourceId' in party ? (party.sourceId ?? null) : null,
  };
}

export function HandoverPartyDialog({
  open,
  onOpenChange,
  side,
  form,
  parties,
  selectionOnly = false,
  initialPartyId,
  allowedKinds = ['eps', 'external', 'warehouse', 'other'],
  onSelectPartyId,
  disabled = false,
}: HandoverPartyDialogProps) {
  const intl = useIntl();
  const { userId } = useUser();
  const prefix = side === 'sender' ? 'sender' : 'recipient';
  const dialogForm = useForm<PartyDialogValues>({
    defaultValues: {
      kind: 'eps',
      partyId: '',
      departmentId: '',
      teamId: '',
      personId: '',
      scopePartyId: '',
      code: '',
      name: '',
      representativeName: '',
      representativeUserId: null,
      phone: '',
      email: '',
    },
  });
  const didInitializeRef = useRef(false);
  const allParties = useMemo(
    () => parties.filter((party) => !party.isHandoverCustom).map(mapParty),
    [parties],
  );
  const selectedDepartmentId = dialogForm.watch('departmentId');
  const selectedTeamId = dialogForm.watch('teamId');
  const senderAllowedIds = new Set(
    parties
      .filter((party) => party.canRepresent && party.canManageHandover)
      .map((party) => party.id),
  );
  const partyCanBeSender = (party: PartyCatalogItem) =>
    side !== 'sender' ||
    (party.isHandoverCustom
      ? party.canRepresent
      : senderAllowedIds.has(party.id));
  const teams = allParties.filter(
    (party) =>
      party.type === 'team' &&
      party.sourceType === 'eps_team' &&
      party.parentId === selectedDepartmentId &&
      partyCanBeSender(party),
  );
  const departments = allParties.filter(
    (party) =>
      party.type === 'department' &&
      party.sourceType === 'eps_department' &&
      partyCanBeSender(party),
  );
  const externalParties = allParties.filter(
    (party) =>
      party.type === 'external' &&
      !party.isHandoverCustom &&
      partyCanBeSender(party),
  );
  const warehouseParties = allParties.filter(
    (party) =>
      party.type === 'warehouse' &&
      !party.isHandoverCustom &&
      partyCanBeSender(party),
  );
  const partyKind = dialogForm.watch('kind');
  const senderScopeOptions = parties.filter(
    (party) =>
      party.isActive &&
      !party.isHandoverCustom &&
      party.canRepresent &&
      party.canManageHandover,
  );
  const representativeOptions = allParties
    .filter(
      (party) =>
        party.id === dialogForm.watch('partyId') &&
        (party.representativeDisplayName || party.representativeName),
    )
    .map((party) => ({
      value: party.representativeDisplayName ?? party.representativeName ?? '',
      label: party.representativeDisplayName ?? party.representativeName ?? '',
    }))
    .filter(
      (option, index, options) =>
        option.value &&
        options.findIndex((item) => item.value === option.value) === index,
    );

  const applyCatalogParty = (
    party: PartyCatalogItem,
    kind: HandoverPartyKind,
  ) => {
    dialogForm.setValue('kind', kind);
    dialogForm.setValue('partyId', party.id);
    dialogForm.setValue('code', party.code);
    dialogForm.setValue('name', party.name);
    dialogForm.setValue(
      'representativeName',
      party.representativeName ?? party.representativeDisplayName ?? '',
    );
    dialogForm.setValue('representativeUserId', party.representativeUserId);
    dialogForm.setValue('phone', party.phone ?? '');
    dialogForm.setValue('email', party.email ?? '');
    dialogForm.setValue('scopePartyId', party.handoverScopePartyId ?? '');
    if (party.type === 'department') {
      dialogForm.setValue('departmentId', party.id);
      dialogForm.setValue('teamId', '');
      dialogForm.setValue('personId', '');
    } else if (party.type === 'team') {
      dialogForm.setValue('departmentId', party.parentId ?? '');
      dialogForm.setValue('teamId', party.id);
      dialogForm.setValue('personId', '');
    } else if (party.type === 'person') {
      const parent = allParties.find((item) => item.id === party.parentId);
      dialogForm.setValue(
        'departmentId',
        parent?.type === 'team' ? (parent.parentId ?? '') : (parent?.id ?? ''),
      );
      dialogForm.setValue('teamId', parent?.type === 'team' ? parent.id : '');
      dialogForm.setValue('personId', party.id);
    }
  };

  useEffect(() => {
    if (!open) {
      didInitializeRef.current = false;
      return;
    }
    if (didInitializeRef.current) return;
    didInitializeRef.current = true;
    const partyId = initialPartyId ?? form.getValues(`${prefix}PartyId`);
    const party = allParties.find((item) => item.id === partyId);
    const kind = selectionOnly
      ? snapshotToKind(party)
      : form.getValues(`${prefix}PartyKind`);
    const type = party?.type;
    const personParent =
      type === 'person'
        ? allParties.find((item) => item.id === party?.parentId)
        : undefined;
    dialogForm.reset({
      kind: kind ?? snapshotToKind(party),
      partyId: kind === 'other' ? '' : partyId,
      departmentId:
        type === 'department'
          ? partyId
          : type === 'team'
            ? (party?.parentId ?? '')
            : type === 'person'
              ? personParent?.type === 'team'
                ? (personParent.parentId ?? '')
                : (personParent?.id ?? '')
              : '',
      teamId:
        type === 'team'
          ? partyId
          : type === 'person' && personParent?.type === 'team'
            ? personParent.id
            : '',
      personId: type === 'person' ? partyId : '',
      scopePartyId:
        form.getValues(`${prefix}PartyScopePartyId`) ||
        party?.handoverScopePartyId ||
        '',
      name: form.getValues(`${prefix}PartyName`) ?? party?.name ?? '',
      code: form.getValues(`${prefix}PartyCode`) ?? party?.code ?? '',
      representativeName:
        form.getValues(`${prefix}RepresentativeName`) ??
        party?.representativeName ??
        party?.representativeDisplayName ??
        '',
      representativeUserId:
        form.getValues(`${prefix}RepresentativeUserId`) ??
        party?.representativeUserId ??
        null,
      phone: form.getValues(`${prefix}PartyPhone`) ?? party?.phone ?? '',
      email: form.getValues(`${prefix}PartyEmail`) ?? party?.email ?? '',
    });
  }, [
    allParties,
    dialogForm,
    form,
    initialPartyId,
    open,
    prefix,
    selectionOnly,
  ]);

  const setKind = (kind: HandoverPartyKind) => {
    if (!allowedKinds.includes(kind) || disabled) return;
    const current = dialogForm.getValues();
    if (current.kind === kind) return;
    const senderScopePartyId = form.getValues('senderPartyScopePartyId');
    const senderPartyId = form.getValues('senderPartyId');
    dialogForm.reset({
      ...current,
      kind,
      partyId: '',
      departmentId: '',
      teamId: '',
      personId: '',
      scopePartyId:
        kind !== 'other'
          ? ''
          : side === 'sender'
            ? current.scopePartyId ||
              current.partyId ||
              senderScopeOptions[0]?.id ||
              ''
            : current.scopePartyId || senderScopePartyId || senderPartyId || '',
      name: '',
      code: '',
      representativeName: '',
      representativeUserId: null,
      phone: '',
      email: '',
    });
  };

  const save = dialogForm.handleSubmit((values) => {
    const partyId =
      values.kind === 'other'
        ? ''
        : values.kind === 'eps' && values.personId
          ? values.personId
          : values.kind === 'eps' && values.teamId
            ? values.teamId
            : values.kind === 'eps' && values.departmentId
              ? values.departmentId
              : values.partyId;
    if (selectionOnly) {
      if (!partyId) return;
      onSelectPartyId?.(partyId);
      onOpenChange(false);
      return;
    }
    const id = fieldName(side, 'PartyId');
    const kindName = fieldName(side, 'PartyKind');
    const codeName = fieldName(side, 'PartyCode');
    const name = fieldName(side, 'PartyName');
    const phone = fieldName(side, 'PartyPhone');
    const email = fieldName(side, 'PartyEmail');
    const representative = fieldName(side, 'RepresentativeName');
    const representativeId = fieldName(side, 'RepresentativeUserId');
    const scopePartyId = fieldName(side, 'PartyScopePartyId');
    form.setValue(id, partyId, { shouldDirty: true, shouldValidate: true });
    form.setValue(kindName, values.kind, { shouldDirty: true });
    form.setValue(codeName, values.code.trim(), { shouldDirty: true });
    form.setValue(name, values.name.trim(), {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue(phone, values.phone.trim(), { shouldDirty: true });
    form.setValue(email, values.email.trim(), {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue(representative, values.representativeName.trim(), {
      shouldDirty: true,
    });
    form.setValue(representativeId, values.representativeUserId, {
      shouldDirty: true,
    });
    form.setValue(scopePartyId, values.scopePartyId, {
      shouldDirty: true,
      shouldValidate: true,
    });
    onOpenChange(false);
  });

  const partyOptions = (items: PartyCatalogItem[]) =>
    items.map((party) => ({
      value: party.id,
      label: `${party.name} · ${party.code}`,
    }));
  const isInvalid = selectionOnly
    ? disabled || !dialogForm.watch('partyId')
    : !dialogForm.watch('name').trim() ||
      (dialogForm.watch('kind') === 'eps' &&
        !dialogForm.watch('departmentId')) ||
      ((dialogForm.watch('kind') === 'external' ||
        dialogForm.watch('kind') === 'warehouse') &&
        !dialogForm.watch('partyId')) ||
      (dialogForm.watch('kind') === 'other' &&
        side === 'sender' &&
        !dialogForm.watch('scopePartyId')) ||
      Boolean(
        dialogForm.watch('email') &&
        !/^\S+@\S+\.\S+$/.test(dialogForm.watch('email')),
      );

  return (
    <HandoverPartyDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onSave={() => void save()}
      isInvalid={isInvalid || disabled}
    >
      <Form {...dialogForm}>
        <div className="space-y-5">
          <FormField
            control={dialogForm.control}
            name="kind"
            render={({ field }) => (
              <FormItem layout="horizontal" labelWidth="md" alignment="start">
                <FormLabel>
                  {intl.formatMessage({
                    id: 'project.handover.partyDialog.kind',
                  })}
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={(value) =>
                      setKind(value as HandoverPartyKind)
                    }
                    className={`grid gap-2 ${allowedKinds.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-4'}`}
                  >
                    {allowedKinds.map((kind) => (
                      <label
                        key={kind}
                        htmlFor={`${side}-party-kind-${kind}`}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <RadioGroupItem
                          id={`${side}-party-kind-${kind}`}
                          value={kind}
                        />
                        {intl.formatMessage({
                          id: `project.handover.partyDialog.kind.${kind}`,
                        })}
                      </label>
                    ))}
                  </RadioGroup>
                </FormControl>
              </FormItem>
            )}
          />

          {dialogForm.watch('kind') === 'eps' ? (
            <>
              <FormField
                control={dialogForm.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id: 'project.handover.partyDialog.epsDepartment',
                      })}
                      <span className="text-destructive"> *</span>
                    </FormLabel>
                    <FormControl>
                      <OptionSelect
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          dialogForm.setValue('teamId', '');
                          dialogForm.setValue('personId', '');
                          const department = departments.find(
                            (item) => item.id === value,
                          );
                          if (department) applyCatalogParty(department, 'eps');
                          else dialogForm.setValue('partyId', '');
                        }}
                        options={partyOptions(departments)}
                        placeholder={intl.formatMessage({
                          id: 'project.handover.partyDialog.selectParty',
                        })}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={dialogForm.control}
                name="teamId"
                render={({ field }) => (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id: 'project.handover.partyDialog.epsTeam',
                      })}
                    </FormLabel>
                    <FormControl>
                      <OptionSelect
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          const team = teams.find((item) => item.id === value);
                          const department = departments.find(
                            (item) => item.id === selectedDepartmentId,
                          );
                          if (team) applyCatalogParty(team, 'eps');
                          else if (department)
                            applyCatalogParty(department, 'eps');
                        }}
                        options={partyOptions(teams)}
                        placeholder={intl.formatMessage({
                          id: 'project.handover.partyDialog.selectTeam',
                        })}
                        disabled={!selectedDepartmentId}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={dialogForm.control}
                name="personId"
                render={({ field }) => (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id: 'project.handover.partyDialog.epsEmployee',
                      })}
                    </FormLabel>
                    <FormControl>
                      <ApiOptionSelect<
                        EpsEmployeeCatalogEntry,
                        { departmentId?: string; teamId?: string }
                      >
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          if (!value) {
                            const parent = allParties.find(
                              (item) =>
                                item.id ===
                                (selectedTeamId || selectedDepartmentId),
                            );
                            if (parent) applyCatalogParty(parent, 'eps');
                          }
                        }}
                        onSelect={(option) => {
                          const employee = option?.data;
                          if (!employee) return;
                          const party: PartyCatalogItem = {
                            id: employee.id,
                            type: 'person',
                            code: employee.code,
                            name: employee.name,
                            parentId: employee.teamId ?? employee.departmentId,
                            representativeUserId: null,
                            representativeDisplayName: null,
                            representativeName: null,
                            phone: null,
                            email: null,
                            isHandoverCustom: false,
                            handoverScopePartyId: null,
                            canRepresent: true,
                            sourceType: 'eps_person',
                            sourceId: employee.sourceId,
                          };
                          applyCatalogParty(party, 'eps');
                        }}
                        loadOptions={async ({
                          search,
                          filters,
                          page,
                          pageSize,
                          signal,
                        }) => {
                          const result = await loadEpsOwnerEmployees(
                            { search, ...filters, page, pageSize },
                            signal,
                          );
                          return {
                            options: result.items.map((employee) => ({
                              value: employee.id,
                              label: `${employee.name} · ${employee.code}`,
                              searchableText: `${employee.name} ${employee.code}`,
                              data: employee,
                            })),
                            hasMore: page * pageSize < result.total,
                          };
                        }}
                        cacheKey={[
                          'project',
                          'custodians',
                          'eps-employees',
                          userId,
                          side,
                        ]}
                        filters={{
                          departmentId: selectedDepartmentId || undefined,
                          teamId: selectedTeamId || undefined,
                        }}
                        selectedOption={
                          field.value && dialogForm.getValues('name')
                            ? {
                                value: field.value,
                                label: `${dialogForm.getValues('name')} · ${dialogForm.getValues('code')}`,
                              }
                            : undefined
                        }
                        placeholder={intl.formatMessage({
                          id: 'project.handover.partyDialog.selectParty',
                        })}
                        disabled={!selectedDepartmentId}
                        pageSize={30}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </>
          ) : null}

          {dialogForm.watch('kind') === 'external' ? (
            <FormField
              control={dialogForm.control}
              name="partyId"
              render={({ field }) => (
                <FormItem layout="horizontal" labelWidth="md">
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'project.handover.partyDialog.catalogParty',
                    })}
                    <span className="text-destructive"> *</span>
                  </FormLabel>
                  <FormControl>
                    <OptionSelect
                      value={field.value}
                      onChange={(value) => {
                        const party = externalParties.find(
                          (item) => item.id === value,
                        );
                        if (party) applyCatalogParty(party, 'external');
                        else field.onChange(value);
                      }}
                      options={partyOptions(externalParties)}
                      placeholder={intl.formatMessage({
                        id: 'project.handover.partyDialog.selectParty',
                      })}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ) : null}

          {dialogForm.watch('kind') === 'warehouse' ? (
            <FormField
              control={dialogForm.control}
              name="partyId"
              render={({ field }) => (
                <FormItem layout="horizontal" labelWidth="md">
                  <FormLabel>
                    {intl.formatMessage({ id: 'receipts.columns.warehouse' })}
                    <span className="text-destructive"> *</span>
                  </FormLabel>
                  <FormControl>
                    <OptionSelect
                      value={field.value}
                      onChange={(value) => {
                        const party = warehouseParties.find(
                          (item) => item.id === value,
                        );
                        if (party) applyCatalogParty(party, 'warehouse');
                        else field.onChange(value);
                      }}
                      options={partyOptions(warehouseParties)}
                      placeholder={intl.formatMessage({
                        id: 'project.handover.partyDialog.selectParty',
                      })}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ) : null}

          {partyKind === 'other' && side === 'sender' ? (
            <FormField
              control={dialogForm.control}
              name="scopePartyId"
              render={({ field }) => (
                <FormItem layout="horizontal" labelWidth="md">
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'project.handover.partyDialog.authorizationScope',
                    })}
                    <span className="text-destructive"> *</span>
                  </FormLabel>
                  <FormControl>
                    <OptionSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={partyOptions(senderScopeOptions.map(mapParty))}
                      placeholder={intl.formatMessage({
                        id: 'project.handover.partyDialog.selectParty',
                      })}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ) : null}

          {!selectionOnly ? (
            <>
              <FormField
                control={dialogForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id: 'project.handover.custodians.fields.code',
                      })}
                    </FormLabel>
                    <FormControl>
                      {partyKind === 'other' ? (
                        <Input {...field} />
                      ) : (
                        <div className="flex min-h-9 items-center text-sm text-foreground">
                          {field.value || '—'}
                        </div>
                      )}
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={dialogForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id: 'project.handover.custodians.fields.name',
                      })}
                      <span className="text-destructive"> *</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={dialogForm.control}
                name="representativeName"
                render={({ field }) => (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id: 'project.handover.fields.representative',
                      })}
                    </FormLabel>
                    <FormControl>
                      <AutocompleteInput
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          dialogForm.setValue('representativeUserId', null);
                        }}
                        options={representativeOptions}
                        onOptionSelect={(option) => {
                          const party = allParties.find(
                            (item) =>
                              item.id === dialogForm.getValues('partyId') &&
                              (item.representativeDisplayName ===
                                option.value ||
                                item.representativeName === option.value),
                          );
                          dialogForm.setValue(
                            'representativeUserId',
                            party?.representativeUserId ?? null,
                          );
                        }}
                        emptyMessage={intl.formatMessage({
                          id: 'project.handover.partyDialog.noSuggestions',
                        })}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={dialogForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id: 'project.handover.fields.phone',
                      })}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={dialogForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id: 'project.handover.fields.email',
                      })}
                    </FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {dialogForm.watch('email') &&
              !/^\S+@\S+\.\S+$/.test(dialogForm.watch('email')) ? (
                <p className="text-xs text-destructive" role="alert">
                  {intl.formatMessage({
                    id: 'project.handover.partyDialog.invalidEmail',
                  })}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </Form>
    </HandoverPartyDialogShell>
  );
}
