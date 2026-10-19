/**
 * Scaffolded by table-builder from `src/project/handover/table/handover.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import type { HandoverDocument } from '../model/handover';

export const HANDOVER_DOCUMENT_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export function useHandoverDocumentColumns(params: {
  onView: (row: HandoverDocument) => void;
}): ColumnDef<HandoverDocument>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<HandoverDocument>();

    return [
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
        size: 180,
        enableSorting: false,
        cell: (row) =>
          intl.formatMessage({ id: `project.handover.type.${row.type}` }),
      }),
      col.custom({
        id: 'parties',
        header: intl.formatMessage({ id: 'project.handover.columns.parties' }),
        size: 320,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">
              {row.senderParty.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              → {row.recipientParty.name}
            </span>
          </div>
        ),
      }),
      col.custom({
        id: 'items',
        header: intl.formatMessage({ id: 'project.handover.columns.items' }),
        size: 220,
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
        size: 170,
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
      col.date({
        id: 'createdAt',
        header: intl.formatMessage({
          id: 'project.handover.columns.createdAt',
        }),
        get: (row) => row.createdAt,
        mode: 'date',
        size: 150,
        enableSorting: false,
      }),
      col.actions({
        id: 'actions',
        header: '',
        cellClassName: 'text-right',
        size: getDataGridActionsColumnSize(1),
        enableSorting: false,
        cell: (row) => (
          <div className="flex justify-end">
            <DataGridActionButton
              action="view"
              mode="icon"
              size="sm"
              tooltip={intl.formatMessage({
                id: 'project.handover.actions.view',
              })}
              aria-label={intl.formatMessage({
                id: 'project.handover.actions.view',
              })}
              onClick={() => params.onView(row)}
            >
              <Eye className="size-4" />
            </DataGridActionButton>
          </div>
        ),
      }),
    ];
  }, [intl, params]);
}
