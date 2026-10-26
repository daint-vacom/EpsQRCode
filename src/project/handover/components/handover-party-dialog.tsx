import { useEffect, useMemo, useRef } from 'react';
import type {
  Custodian,
  HandoverCustomParty,
} from '@/project/custodians/model/custodian';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { HandoverFormValues, HandoverPartyKind } from '../model/handover';
import { HandoverPartyDialogShell } from './handover-party-dialog-shell.generated';

type Side = 'sender' | 'recipient';

interface PartyDialogValues {
  kind: HandoverPartyKind;
  partyId: string;
  departmentId: string;
  teamId: string;
  scopePartyId: string;
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
}

interface HandoverPartyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: Side;
  form: UseFormReturn<HandoverFormValues>;
  parties: Custodian[];
  customParties: HandoverCustomParty[];
}

function fieldName(side: Side, key: string) {
  return `${side === 'sender' ? 'sender' : 'recipient'}${key}` as const;
}

function normalizePartyName(value: string) {
  return value
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('vi-VN');
}

function snapshotToKind(
  party?: Custodian | HandoverCustomParty,
): HandoverPartyKind {
  if (party?.isHandoverCustom || party?.type === 'other') return 'other';
  if (party?.type === 'external') return 'external';
  return 'eps';
}

function mapParty(party: Custodian | HandoverCustomParty): PartyCatalogItem {
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
  };
}

export function HandoverPartyDialog({
  open,
  onOpenChange,
  side,
  form,
  parties,
  customParties,
}: HandoverPartyDialogProps) {
  const intl = useIntl();
  const prefix = side === 'sender' ? 'sender' : 'recipient';
  const dialogForm = useForm<PartyDialogValues>({
    defaultValues: {
      kind: 'eps',
      partyId: '',
      departmentId: '',
      teamId: '',
      scopePartyId: '',
      name: '',
      representativeName: '',
      representativeUserId: null,
      phone: '',
      email: '',
    },
  });
  const didInitializeRef = useRef(false);
  const allParties = useMemo(
    () => [
      ...parties.filter((party) => !party.isHandoverCustom).map(mapParty),
      ...customParties.map(mapParty),
    ],
    [customParties, parties],
  );
  const selectedParty = allParties.find(
    (party) => party.id === dialogForm.watch('partyId'),
  );
  const selectedDepartmentId = dialogForm.watch('departmentId');
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
      party.parentId === selectedDepartmentId &&
      partyCanBeSender(party),
  );
  const departments = allParties.filter(
    (party) => party.type === 'department' && partyCanBeSender(party),
  );
  const externalParties = allParties.filter(
    (party) =>
      party.type === 'external' &&
      !party.isHandoverCustom &&
      partyCanBeSender(party),
  );
  const customPartyRecords = allParties.filter(
    (party) => party.isHandoverCustom && partyCanBeSender(party),
  );
  const partyName = dialogForm.watch('name');
  const partyKind = dialogForm.watch('kind');
  const normalizedPartyName = normalizePartyName(partyName);
  const matchingCustomParties = normalizedPartyName
    ? customPartyRecords.filter(
        (party) => normalizePartyName(party.name) === normalizedPartyName,
      )
    : [];
  const matchingCustomParty =
    matchingCustomParties.length === 1 ? matchingCustomParties[0] : undefined;
  const matchingCustomPartyId = matchingCustomParty?.id ?? '';
  const matchingCustomPartyScopeId =
    matchingCustomParty?.handoverScopePartyId ?? '';
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
    } else if (party.type === 'team') {
      dialogForm.setValue('departmentId', party.parentId ?? '');
      dialogForm.setValue('teamId', party.id);
    }
  };

  useEffect(() => {
    if (!open) {
      didInitializeRef.current = false;
      return;
    }
    if (didInitializeRef.current) return;
    didInitializeRef.current = true;
    const partyId = form.getValues(`${prefix}PartyId`);
    const party = allParties.find((item) => item.id === partyId);
    const kind = form.getValues(`${prefix}PartyKind`);
    const type = party?.type;
    dialogForm.reset({
      kind: kind ?? snapshotToKind(party),
      partyId,
      departmentId:
        type === 'department'
          ? partyId
          : type === 'team'
            ? (party?.parentId ?? '')
            : '',
      teamId: type === 'team' ? partyId : '',
      scopePartyId:
        form.getValues(`${prefix}PartyScopePartyId`) ||
        party?.handoverScopePartyId ||
        '',
      name: form.getValues(`${prefix}PartyName`) || party?.name || '',
      representativeName:
        form.getValues(`${prefix}RepresentativeName`) ||
        party?.representativeName ||
        party?.representativeDisplayName ||
        '',
      representativeUserId:
        form.getValues(`${prefix}RepresentativeUserId`) ??
        party?.representativeUserId ??
        null,
      phone: form.getValues(`${prefix}PartyPhone`) || party?.phone || '',
      email: form.getValues(`${prefix}PartyEmail`) || party?.email || '',
    });
  }, [allParties, dialogForm, form, open, prefix]);

  useEffect(() => {
    if (!open || partyKind !== 'other') return;
    if (dialogForm.getValues('partyId') !== matchingCustomPartyId) {
      dialogForm.setValue('partyId', matchingCustomPartyId, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (dialogForm.getValues('scopePartyId') !== matchingCustomPartyScopeId) {
      dialogForm.setValue('scopePartyId', matchingCustomPartyScopeId);
    }
  }, [
    dialogForm,
    matchingCustomPartyId,
    matchingCustomPartyScopeId,
    open,
    partyKind,
  ]);

  const setKind = (kind: HandoverPartyKind) => {
    const current = dialogForm.getValues();
    if (current.kind === kind) return;
    dialogForm.reset({
      ...current,
      kind,
      partyId: '',
      departmentId: '',
      teamId: '',
      scopePartyId:
        kind === 'other' && side === 'sender' ? current.scopePartyId : '',
      name: '',
      representativeName: '',
      representativeUserId: null,
      phone: '',
      email: '',
    });
  };

  const save = dialogForm.handleSubmit((values) => {
    const partyId =
      values.kind === 'eps' && values.teamId
        ? values.teamId
        : values.kind === 'eps' && values.departmentId
          ? values.departmentId
          : values.partyId;
    const selected = allParties.find((party) => party.id === partyId);
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
    form.setValue(codeName, selected?.code ?? '', { shouldDirty: true });
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
  const isInvalid =
    !dialogForm.watch('name').trim() ||
    (dialogForm.watch('kind') === 'eps' && !dialogForm.watch('departmentId')) ||
    (dialogForm.watch('kind') === 'external' && !dialogForm.watch('partyId')) ||
    (dialogForm.watch('kind') === 'other' &&
      side === 'sender' &&
      !dialogForm.watch('partyId')) ||
    Boolean(
      dialogForm.watch('email') &&
      !/^\S+@\S+\.\S+$/.test(dialogForm.watch('email')),
    );

  return (
    <HandoverPartyDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onSave={() => void save()}
      isInvalid={isInvalid}
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
                    className="grid gap-2 sm:grid-cols-3"
                  >
                    {(['eps', 'external', 'other'] as const).map((kind) => (
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
              {teams.length ? (
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
                            const team = teams.find(
                              (item) => item.id === value,
                            );
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
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ) : null}
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
                  <Input
                    {...field}
                    onChange={(event) => {
                      field.onChange(event);
                      if (partyKind !== 'other') return;
                      const enteredName = normalizePartyName(
                        event.target.value,
                      );
                      const matches = customPartyRecords.filter(
                        (party) =>
                          normalizePartyName(party.name) === enteredName,
                      );
                      const match =
                        matches.length === 1 ? matches[0] : undefined;
                      dialogForm.setValue('partyId', match?.id ?? '', {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      dialogForm.setValue(
                        'scopePartyId',
                        match?.handoverScopePartyId ?? '',
                      );
                    }}
                  />
                </FormControl>
                {partyKind === 'other' &&
                side === 'sender' &&
                partyName.trim() &&
                !selectedParty?.isHandoverCustom ? (
                  <FormDescription>
                    {intl.formatMessage({
                      id: 'project.handover.partyDialog.senderOtherMatchingHint',
                    })}
                  </FormDescription>
                ) : null}
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
                          (item.representativeDisplayName === option.value ||
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
                  {intl.formatMessage({ id: 'project.handover.fields.phone' })}
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
                  {intl.formatMessage({ id: 'project.handover.fields.email' })}
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
        </div>
      </Form>
    </HandoverPartyDialogShell>
  );
}
