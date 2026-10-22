/**
 * Scaffolded by table-builder from `src/project/handover/table/custodian.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import type { Custodian } from '../../custodians/model/custodian';

export const CUSTODIAN_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export function useCustodianColumns({
  canManage,
  onEdit,
}: {
  canManage: boolean;
  onEdit: (custodian: Custodian) => void;
}): ColumnDef<Custodian>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<Custodian>();

    return [
      col.custom({
        id: 'name',
        header: intl.formatMessage({
          id: 'project.handover.custodians.fields.name',
        }),
        size: 320,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{row.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {row.code}
            </span>
          </div>
        ),
      }),
      col.custom({
        id: 'type',
        header: intl.formatMessage({
          id: 'project.handover.custodians.fields.type',
        }),
        size: 180,
        enableSorting: false,
        cell: (row) =>
          intl.formatMessage({
            id: `project.handover.custodians.type.${row.type}`,
          }),
      }),
      col.custom({
        id: 'parent',
        header: intl.formatMessage({
          id: 'project.handover.custodians.fields.parent',
        }),
        size: 220,
        enableSorting: false,
        cell: (row) => (
          <span className="text-muted-foreground">{row.parentId ?? ''}</span>
        ),
      }),
      col.custom({
        id: 'representative',
        header: intl.formatMessage({
          id: 'project.handover.custodians.fields.representative',
        }),
        size: 220,
        enableSorting: false,
        cell: (row) => row.representativeDisplayName ?? '',
      }),
      col.custom({
        id: 'isActive',
        header: intl.formatMessage({ id: 'project.handover.fields.status' }),
        size: 170,
        enableSorting: false,
        cell: (row) => (
          <Badge variant={row.isActive ? 'success' : 'secondary'}>
            {row.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
          </Badge>
        ),
      }),
      col.actions({
        id: 'actions',
        header: '',
        cellClassName: 'text-right',
        size: getDataGridActionsColumnSize(1),
        enableSorting: false,
        cell: (row) =>
          canManage ? (
            <div className="flex justify-end">
              <DataGridActionButton
                action="edit"
                mode="icon"
                size="sm"
                tooltip={intl.formatMessage({
                  id: 'project.handover.custodians.actions.edit',
                })}
                aria-label={intl.formatMessage({
                  id: 'project.handover.custodians.actions.edit',
                })}
                onClick={() => onEdit(row)}
              >
                <Pencil className="size-4" />
              </DataGridActionButton>
            </div>
          ) : null,
      }),
    ];
  }, [canManage, intl, onEdit]);
}
