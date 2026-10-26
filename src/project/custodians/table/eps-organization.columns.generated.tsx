/**
 * Scaffolded by table-builder from `src/project/custodians/table/eps-organization.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useIntl } from 'react-intl';
import { createColumnHelpers } from '@/components/ui/data-grid-columns';
import { RepresentativeAccountsCell } from '../components/representative-accounts-cell';
import type { EpsOrganization } from '../model/custodian';

export interface UseEpsOrganizationColumnsParams {
  canManage: boolean;
  isSaving: boolean;
  onSaveRepresentatives: (
    row: EpsOrganization,
    userIds: string[],
  ) => Promise<void>;
}

export function useEpsOrganizationColumns(
  params: UseEpsOrganizationColumnsParams,
): ColumnDef<EpsOrganization>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<EpsOrganization>();

    return [
      col.text({
        id: 'code',
        header: intl.formatMessage({ id: 'custodians.eps.columns.code' }),
        get: (row) => row.code,
        size: 160,
        enableSorting: false,
      }),
      col.custom({
        id: 'name',
        header: intl.formatMessage({ id: 'custodians.eps.columns.name' }),
        size: 320,
        enableSorting: false,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{row.name}</span>
            {row.parentName ? (
              <span className="truncate text-xs text-muted-foreground">
                {row.parentName}
              </span>
            ) : null}
          </div>
        ),
      }),
      col.custom({
        id: 'representatives',
        header: intl.formatMessage({
          id: 'custodians.eps.columns.representatives',
        }),
        size: 360,
        enableSorting: false,
        cell: (row) => (
          <RepresentativeAccountsCell
            entityName={row.name}
            value={row.representativeUserIds}
            accounts={
              params.canManage && row.canManageRepresentatives
                ? row.representativeOptions
                : row.representativeAccounts
            }
            canManage={params.canManage && row.canManageRepresentatives}
            isSaving={params.isSaving}
            onSave={(userIds) => params.onSaveRepresentatives(row, userIds)}
          />
        ),
      }),
    ];
  }, [intl, params]);
}
