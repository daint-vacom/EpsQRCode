/**
 * Scaffolded by table-builder from `src/project/handover/table/handover.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { CircleCheck, CircleEllipsis, CircleX, Eye } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { HandoverDocument } from '../model/handover';

export const HANDOVER_DOCUMENT_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

type SignatureStatus = 'signed' | 'pending' | 'rejected';

function SignatureStatusIcon({
  status,
  label,
}: {
  status: SignatureStatus;
  label: string;
}) {
  const iconClassName =
    status === 'signed'
      ? 'text-[var(--color-success-accent,var(--color-green-600))]'
      : status === 'rejected'
        ? 'text-destructive'
        : 'text-muted-foreground';
  const Icon =
    status === 'signed'
      ? CircleCheck
      : status === 'rejected'
        ? CircleX
        : CircleEllipsis;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={label}
          className="mt-0.5 inline-flex shrink-0 cursor-help"
          role="img"
          tabIndex={0}
        >
          <Icon aria-hidden="true" className={`size-5 ${iconClassName}`} />
        </span>
      </TooltipTrigger>
      <TooltipContent
        variant={
          status === 'signed'
            ? 'success'
            : status === 'rejected'
              ? 'destructive'
              : 'warning'
        }
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function useHandoverDocumentColumns(params: {
  onView: (row: HandoverDocument) => void;
  showViewLabel?: boolean;
}): ColumnDef<HandoverDocument>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<HandoverDocument>();

    return [
      col.date({
        id: 'createdAt',
        header: intl.formatMessage({
          id: 'project.handover.columns.createdAt',
        }),
        get: (row) => row.createdAt,
        mode: 'date',
        size: 130,
        enableSorting: false,
      }),
      col.text({
        id: 'code',
        header: intl.formatMessage({ id: 'project.handover.columns.code' }),
        get: (row) => row.code,
        size: 160,
        enableSorting: false,
      }),
      col.custom({
        id: 'type',
        header: intl.formatMessage({ id: 'project.handover.fields.type' }),
        size: 140,
        enableSorting: false,
        cell: (row) =>
          intl.formatMessage({ id: `project.handover.type.${row.type}` }),
      }),
      col.custom({
        id: 'senderParty',
        header: intl.formatMessage({ id: 'project.handover.fields.sender' }),
        size: 220,
        enableSorting: false,
        cell: (row) => {
          const senderStatus: SignatureStatus =
            row.status === 'rejected' && row.mode === 'warehouse_request'
              ? 'rejected'
              : row.status === 'pending' ||
                  row.status === 'completed' ||
                  row.status === 'rejected' ||
                  (row.status === 'awaiting_warehouse_approval' &&
                    row.mode !== 'warehouse_request')
                ? 'signed'
                : 'pending';
          const label = intl.formatMessage({
            id:
              senderStatus === 'signed'
                ? 'project.handover.table.signed'
                : 'project.handover.table.pending',
          });

          return (
            <div className="flex min-w-0 items-start gap-2">
              <SignatureStatusIcon status={senderStatus} label={label} />
              <span className="whitespace-normal break-words">
                {row.senderParty.name}
              </span>
            </div>
          );
        },
      }),
      col.custom({
        id: 'recipientParty',
        header: intl.formatMessage({
          id: 'project.handover.fields.recipient',
        }),
        size: 220,
        enableSorting: false,
        cell: (row) => {
          const recipientStatus: SignatureStatus =
            row.status === 'rejected' && row.mode !== 'warehouse_request'
              ? 'rejected'
              : (row.status === 'completed' &&
                    (row.mode !== 'standard' || row.recipientHasQrAccount)) ||
                  (row.mode === 'warehouse_request' &&
                    [
                      'awaiting_warehouse_approval',
                      'pending',
                      'rejected',
                    ].includes(row.status))
                ? 'signed'
                : 'pending';
          const label = intl.formatMessage({
            id: `project.handover.table.${recipientStatus}`,
          });

          return (
            <div className="flex min-w-0 items-start gap-2">
              <SignatureStatusIcon status={recipientStatus} label={label} />
              <span className="whitespace-normal break-words">
                {row.recipientParty.name}
              </span>
            </div>
          );
        },
      }),
      col.custom({
        id: 'items',
        header: intl.formatMessage({ id: 'project.handover.columns.items' }),
        size: 120,
        enableSorting: false,
        cell: (row) =>
          intl.formatMessage(
            { id: 'project.handover.table.materialCount' },
            { count: row.items.length },
          ),
      }),
      col.custom({
        id: 'status',
        header: intl.formatMessage({ id: 'project.handover.fields.status' }),
        size: 130,
        enableSorting: false,
        cell: (row) => {
          const variant =
            row.status === 'completed'
              ? 'success'
              : row.status === 'pending'
                ? 'warning'
                : row.status === 'rejected' || row.status === 'cancelled'
                  ? 'secondary'
                  : 'outline';
          return (
            <Badge variant={variant}>
              {intl.formatMessage({
                id: `project.handover.status.${row.status}`,
              })}
            </Badge>
          );
        },
      }),
      col.actions({
        id: 'actions',
        header: '',
        headerClassName: params.showViewLabel
          ? 'w-[112px] max-w-[112px] px-2'
          : undefined,
        cellClassName: params.showViewLabel
          ? 'w-[112px] max-w-[112px] px-2 text-right'
          : 'text-right',
        size: params.showViewLabel ? 112 : getDataGridActionsColumnSize(1),
        enableSorting: false,
        cell: (row) => (
          <div className="flex items-center justify-end gap-2">
            <DataGridActionButton
              action="view"
              mode={params.showViewLabel ? 'link' : 'icon'}
              size="sm"
              aria-label={intl.formatMessage({
                id: 'project.handover.actions.view',
              })}
              tooltip={
                params.showViewLabel
                  ? undefined
                  : intl.formatMessage({
                      id: 'project.handover.actions.view',
                    })
              }
              onClick={() => params.onView(row)}
            >
              <Eye className="size-3.5" />
              {params.showViewLabel
                ? intl.formatMessage({ id: 'project.handover.actions.view' })
                : null}
            </DataGridActionButton>
          </div>
        ),
      }),
    ];
  }, [intl, params]);
}
