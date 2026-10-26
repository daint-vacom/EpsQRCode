import type { ReactNode } from 'react';
import type { Custodian } from '@/project/custodians/model/custodian';
import { Building2, Mail, Pencil, Phone, UserRound } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { OptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
import type { HandoverFormValues } from '../model/handover-form-schema';

type PartyField = 'senderPartyId' | 'recipientPartyId';
type RepresentativeField =
  'senderRepresentativeUserId' | 'recipientRepresentativeUserId';

interface HandoverPartyCardProps {
  title: string;
  side: 'sender' | 'recipient';
  form: UseFormReturn<HandoverFormValues>;
  partyField: PartyField;
  representativeField: RepresentativeField;
  parties: Custodian[];
  partyOptions: SelectOption[];
  representativeOptions: SelectOption[];
  contact?: { phone?: string | null; email?: string | null };
  partyOptionsLoading?: boolean;
  disabled?: boolean;
  notice?: ReactNode;
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => Array.from(part)[0]?.toLocaleUpperCase() ?? '')
    .join('');
}

function PartyInfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof UserRound;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[1rem_7rem_minmax(0,1fr)] items-center gap-2 text-xs">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0 text-foreground">{children}</div>
    </div>
  );
}

function PartySelector({
  form,
  fieldName,
  title,
  options,
  loading,
  disabled,
  triggerContent,
  className,
}: {
  form: UseFormReturn<HandoverFormValues>;
  fieldName: PartyField;
  title: string;
  options: SelectOption[];
  loading: boolean;
  disabled: boolean;
  triggerContent: ReactNode;
  className: string;
}) {
  return (
    <FormField
      control={form.control}
      name={fieldName}
      render={({ field }) => (
        <FormItem variant="compact" className="min-w-0 gap-0">
          <FormLabel className="sr-only">{title}</FormLabel>
          <FormControl>
            <OptionSelect
              ariaLabel={title}
              value={field.value ?? ''}
              onChange={field.onChange}
              options={options}
              searchable={false}
              loading={loading}
              disabled={disabled || loading}
              triggerContent={triggerContent}
              size="sm"
              className={className}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function HandoverPartyCard({
  title,
  side,
  form,
  partyField,
  representativeField,
  parties,
  partyOptions,
  representativeOptions,
  contact,
  partyOptionsLoading = false,
  disabled = false,
  notice,
}: HandoverPartyCardProps) {
  const intl = useIntl();
  const selectedPartyId = form.watch(partyField);
  const selectedRepresentativeId = form.watch(representativeField);
  const party = parties.find((item) => item.id === selectedPartyId);
  const parent = parties.find((item) => item.id === party?.parentId);
  const selectedRepresentative = representativeOptions.find(
    (option) => option.value === selectedRepresentativeId,
  );
  const avatarName = selectedRepresentative?.label || party?.name || '';
  const tone =
    side === 'sender'
      ? {
          card: 'border-transparent bg-blue-50/70 dark:border-transparent dark:bg-blue-950/20',
          icon: 'text-blue-600',
          avatar:
            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
        }
      : {
          card: 'border-transparent bg-emerald-50/70 dark:border-transparent dark:bg-emerald-950/20',
          icon: 'text-emerald-600',
          avatar:
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
        };
  const representativeLabel = intl.formatMessage({
    id: 'project.handover.fields.representative',
  });
  const emptyTitle = intl.formatMessage({
    id:
      side === 'sender'
        ? 'project.handover.empty.selectSender'
        : 'project.handover.empty.selectRecipient',
  });
  const selectPartyLabel = intl.formatMessage({
    id:
      side === 'sender'
        ? 'project.handover.actions.selectSenderParty'
        : 'project.handover.actions.selectRecipientParty',
  });

  return (
    <Card className={`min-w-0 ${tone.card}`}>
      <CardHeader className="min-h-12 px-4 py-2.5">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Building2
            className={`size-5 shrink-0 ${tone.icon}`}
            aria-hidden="true"
          />
          <span className="truncate">{title}</span>
        </CardTitle>
        {party ? (
          <PartySelector
            form={form}
            fieldName={partyField}
            title={title}
            options={partyOptions}
            loading={partyOptionsLoading}
            disabled={disabled || !partyOptions.length}
            triggerContent={
              <span className="inline-flex items-center gap-1.5">
                <Pencil className="size-3.5" aria-hidden="true" />
                {intl.formatMessage({
                  id: 'project.handover.actions.changeParty',
                })}
              </span>
            }
            className="w-auto min-w-[7rem]"
          />
        ) : null}
      </CardHeader>
      {party ? (
        <CardContent className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-x-3 px-4 pb-4 pt-1">
          {notice ? <div className="col-span-2 pb-1">{notice}</div> : null}
          <Avatar className="size-14 shrink-0 border-2 border-background shadow-sm">
            <AvatarFallback className={tone.avatar}>
              {avatarName ? (
                initials(avatarName)
              ) : (
                <Building2 className="size-5" aria-hidden="true" />
              )}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {party.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {parent?.name ?? party.code}
              </p>
            </div>
            <div className="space-y-1.5">
              <PartyInfoRow icon={UserRound} label={representativeLabel}>
                <FormField
                  control={form.control}
                  name={representativeField}
                  render={({ field }) => (
                    <FormItem variant="compact" className="min-w-0 gap-0">
                      <FormLabel className="sr-only">
                        {representativeLabel}
                      </FormLabel>
                      <FormControl>
                        <OptionSelect
                          ariaLabel={representativeLabel}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          options={representativeOptions}
                          placeholder={intl.formatMessage({
                            id: 'project.handover.labels.selectRepresentative',
                          })}
                          searchable={false}
                          disabled={disabled || !representativeOptions.length}
                          variant="ghost"
                          size="sm"
                          className="h-7 min-w-0 justify-start px-1"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </PartyInfoRow>
              <PartyInfoRow
                icon={Phone}
                label={intl.formatMessage({
                  id: 'project.handover.fields.phone',
                })}
              >
                <span className="block min-h-4 truncate">
                  {contact?.phone ?? '\u00a0'}
                </span>
              </PartyInfoRow>
              <PartyInfoRow
                icon={Mail}
                label={intl.formatMessage({
                  id: 'project.handover.fields.email',
                })}
              >
                <span className="block min-h-4 truncate">
                  {contact?.email ?? '\u00a0'}
                </span>
              </PartyInfoRow>
            </div>
          </div>
        </CardContent>
      ) : (
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-4 pt-1 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {emptyTitle}
          </p>
          <PartySelector
            form={form}
            fieldName={partyField}
            title={title}
            options={partyOptions}
            loading={partyOptionsLoading}
            disabled={disabled || !partyOptions.length}
            triggerContent={selectPartyLabel}
            className="w-auto min-w-[9rem]"
          />
          {notice ? <div className="w-full">{notice}</div> : null}
        </CardContent>
      )}
    </Card>
  );
}
