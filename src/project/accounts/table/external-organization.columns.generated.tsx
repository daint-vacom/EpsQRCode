/**
 * Scaffolded by table-builder from `src/project/accounts/table/external-organization.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
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
import type { ExternalOrganization } from '../model/account';

export const EXTERNAL_ORGANIZATION_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export function useExternalOrganizationColumns(params: {
  canManage: boolean;
  onEdit: (organization: ExternalOrganization) => void;
}): ColumnDef<ExternalOrganization>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<ExternalOrganization>();

    return [
      col.text({
        id: 'code',
        header: intl.formatMessage({ id: 'accounts.external.columns.code' }),
        get: (row) => row.code,
        size: 160,
        enableSorting: false,
      }),
      col.custom({
        id: 'name',
        header: intl.formatMessage({ id: 'accounts.external.columns.name' }),
        size: 320,
        enableSorting: false,
        cell: (row) => <span className="text-sm font-medium">{row.name}</span>,
      }),
      col.custom({
        id: 'is_active',
        header: intl.formatMessage({ id: 'accounts.external.columns.status' }),
        size: 170,
        enableSorting: false,
        cell: (row) => (
          <Badge variant={row.is_active ? 'success' : 'secondary'}>
            {intl.formatMessage({
              id: row.is_active
                ? 'accounts.external.status.active'
                : 'accounts.external.status.inactive',
            })}
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
          params.canManage ? (
            <div className="flex justify-end">
              <DataGridActionButton
                action="edit"
                tooltip={intl.formatMessage({ id: 'common.actions.edit' })}
                aria-label={intl.formatMessage({ id: 'common.actions.edit' })}
                type="button"
                mode="icon"
                size="sm"
                onClick={() => params.onEdit(row)}
              >
                <Pencil className="size-4" />
              </DataGridActionButton>
            </div>
          ) : null,
      }),
    ];
  }, [intl, params]);
}
