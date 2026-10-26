/**
 * Scaffolded by table-builder from `src/project/accounts/table/account.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import { useIntl } from 'react-intl';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import { AccountRolesCell } from '../components/account-roles-cell';
import { AccountStatusIndicator } from '../components/account-status-indicator';
import type { Account } from '../model/account';

export const ACCOUNT_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export function useAccountColumns(params: {
  canManage: boolean;
  onEdit: (account: Account) => void;
}): ColumnDef<Account>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<Account>();

    return [
      col.custom({
        id: 'status',
        header: ' ',
        headerClassName: 'w-12 text-center',
        cellClassName: 'text-center',
        size: 48,
        enableSorting: false,
        cell: (row) => <AccountStatusIndicator status={row.status} />,
      }),
      col.custom({
        id: 'identity',
        header: intl.formatMessage({ id: 'accounts.columns.account' }),
        size: 320,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">
              {row.displayName}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {row.username ?? row.userId}
            </span>
          </div>
        ),
      }),
      col.custom({
        id: 'accountType',
        header: intl.formatMessage({ id: 'accounts.columns.type' }),
        size: 160,
        enableSorting: false,
        cell: (row) => (
          <span className="text-sm">
            {intl.formatMessage({ id: `accounts.types.${row.accountType}` })}
          </span>
        ),
      }),
      col.custom({
        id: 'organization',
        header: intl.formatMessage({ id: 'accounts.columns.organization' }),
        size: 280,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">
              {row.accountType === 'eps'
                ? (row.epsDepartmentName ?? '—')
                : row.accountType === 'external'
                  ? (row.externalOrganizationName ?? '—')
                  : '—'}
            </span>
            {row.accountType === 'eps' && row.epsTeamName ? (
              <span className="truncate text-xs text-muted-foreground">
                {row.epsTeamName}
              </span>
            ) : null}
          </div>
        ),
      }),
      col.custom({
        id: 'roles',
        header: intl.formatMessage({ id: 'accounts.columns.roles' }),
        size: 240,
        enableSorting: false,
        cell: (row) => <AccountRolesCell roles={row.roles} />,
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
                tooltip={intl.formatMessage({ id: 'accounts.actions.edit' })}
                aria-label={intl.formatMessage({ id: 'accounts.actions.edit' })}
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
