import { useState, type ReactNode } from 'react';
import type { Custodian } from '@/project/custodians/model/custodian';
import { Building2, Mail, Pencil, Phone, UserRound } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { HandoverFormValues, HandoverPartyKind } from '../model/handover';
import { HandoverPartyDialog } from './handover-party-dialog';

interface HandoverPartyCardProps {
  title: string;
  side: 'sender' | 'recipient';
  form: UseFormReturn<HandoverFormValues>;
  parties: Custodian[];
  readOnly?: boolean;
  statusBadge?: ReactNode;
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
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[1rem_7rem_minmax(0,1fr)] items-center gap-2 text-xs">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-foreground">{value || '—'}</span>
    </div>
  );
}

export function HandoverPartyCard({
  title,
  side,
  form,
  parties,
  readOnly = false,
  statusBadge,
  notice,
}: HandoverPartyCardProps) {
  const intl = useIntl();
  const [dialogOpen, setDialogOpen] = useState(false);
  const partyId = form.watch(`${side}PartyId`);
  const kind = form.watch(`${side}PartyKind`) as HandoverPartyKind;
  const name = form.watch(`${side}PartyName`);
  const code = form.watch(`${side}PartyCode`);
  const representativeName = form.watch(`${side}RepresentativeName`);
  const phone = form.watch(`${side}PartyPhone`);
  const email = form.watch(`${side}PartyEmail`);
  const partyError =
    side === 'sender'
      ? (form.formState.errors.senderPartyName?.message ??
        form.formState.errors.senderPartyId?.message ??
        form.formState.errors.senderPartyScopePartyId?.message ??
        form.formState.errors.senderPartyEmail?.message)
      : (form.formState.errors.recipientPartyName?.message ??
        form.formState.errors.recipientPartyId?.message ??
        form.formState.errors.recipientPartyScopePartyId?.message ??
        form.formState.errors.recipientPartyEmail?.message);
  const party = parties.find((item) => item.id === partyId);
  const parent = party?.parentId
    ? parties.find((item) => item.id === party.parentId)
    : undefined;
  const displayName = name || party?.name || '';
  const displayCode = code || party?.code || '';
  const hasParty = Boolean(partyId || displayName);
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

  return (
    <>
      <Card className={`flex min-w-0 flex-col ${tone.card}`}>
        <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <Building2
                className={`size-5 shrink-0 ${tone.icon}`}
                aria-hidden="true"
              />
              <span className="truncate">{title}</span>
            </CardTitle>
            {statusBadge}
          </div>
          {hasParty && !readOnly ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(true)}
              aria-label={intl.formatMessage({
                id: 'project.handover.actions.editParty',
              })}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              {intl.formatMessage({ id: 'project.handover.actions.editParty' })}
            </Button>
          ) : null}
        </CardHeader>
        {hasParty ? (
          <CardContent className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-x-3 px-4 pb-4 pt-1">
            {notice ? <div className="col-span-2 pb-1">{notice}</div> : null}
            <Avatar className="size-14 shrink-0 border-2 border-background shadow-sm">
              <AvatarFallback className={tone.avatar}>
                {displayName ? (
                  initials(representativeName || displayName)
                ) : (
                  <Building2 className="size-5" aria-hidden="true" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {displayName || '—'}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[0.65rem]">
                    {intl.formatMessage({
                      id: `project.handover.partyDialog.kind.${kind ?? 'eps'}`,
                    })}
                  </Badge>
                  <p className="truncate text-xs text-muted-foreground">
                    {parent?.name ?? displayCode}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <PartyInfoRow
                  icon={UserRound}
                  label={intl.formatMessage({
                    id: 'project.handover.fields.representative',
                  })}
                  value={representativeName || ''}
                />
                <PartyInfoRow
                  icon={Phone}
                  label={intl.formatMessage({
                    id: 'project.handover.fields.phone',
                  })}
                  value={phone || ''}
                />
                <PartyInfoRow
                  icon={Mail}
                  label={intl.formatMessage({
                    id: 'project.handover.fields.email',
                  })}
                  value={email || ''}
                />
              </div>
            </div>
            {partyError ? (
              <p className="col-span-2 text-xs text-destructive" role="alert">
                {partyError}
              </p>
            ) : null}
          </CardContent>
        ) : (
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 px-4 pb-4 pt-1 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {intl.formatMessage({
                id:
                  side === 'sender'
                    ? 'project.handover.empty.selectSender'
                    : 'project.handover.empty.selectRecipient',
              })}
            </p>
            {!readOnly ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                {intl.formatMessage({
                  id: 'project.handover.actions.selectParty',
                })}
              </Button>
            ) : null}
            {notice}
            {partyError ? (
              <p className="text-xs text-destructive" role="alert">
                {partyError}
              </p>
            ) : null}
          </CardContent>
        )}
      </Card>
      {!readOnly ? (
        <HandoverPartyDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          side={side}
          form={form}
          parties={parties}
        />
      ) : null}
    </>
  );
}
