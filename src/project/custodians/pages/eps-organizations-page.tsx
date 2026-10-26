import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Building2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTable,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridHeaderMenu } from '@/components/ui/data-grid-header-menu';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/inputs/search-input';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { replaceCustodianRepresentatives } from '../api/custodians.api';
import { useEpsOrganizationsQuery } from '../hooks/use-custodians';
import type { EpsOrganization, EpsOrganizationType } from '../model/custodian';
import { CUSTODIAN_PERMISSION_CODES } from '../model/custodian-permissions';
import { useEpsOrganizationColumns } from '../table/eps-organization.columns.generated';

const EMPTY_ORGANIZATIONS: EpsOrganization[] = [];

export function EpsOrganizationsPage() {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView =
    hasPermission(CUSTODIAN_PERMISSION_CODES.view) ||
    hasPermission(CUSTODIAN_PERMISSION_CODES.manage);
  const canManage = hasPermission(CUSTODIAN_PERMISSION_CODES.manage);
  const query = useEpsOrganizationsQuery(!isPermissionsPending && canView);
  const representativeMutation = useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
      replaceCustodianRepresentatives(id, userIds),
    onSuccess: async () => {
      toast.success(
        intl.formatMessage({ id: 'custodians.representatives.toasts.updated' }),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', 'custodians'] }),
        queryClient.invalidateQueries({
          queryKey: ['project', 'external-organizations'],
        }),
      ]);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const saveRepresentatives = async (row: EpsOrganization, userIds: string[]) =>
    representativeMutation.mutateAsync({ id: row.id, userIds });

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'custodians.eps.page.title' })}
        icon={Building2}
      />
      {!isPermissionsPending && !canView ? (
        <ErrorState
          title={intl.formatMessage({ id: 'custodians.eps.page.noView' })}
          description={intl.formatMessage({ id: 'custodians.eps.page.noView' })}
        />
      ) : query.isError ? (
        <ErrorState
          title={intl.formatMessage({ id: 'custodians.eps.page.loadError' })}
          description={getApiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
          retryLabel={intl.formatMessage({ id: 'common.actions.retry' })}
        />
      ) : (
        <>
          <EpsOrganizationTable
            type="department"
            records={query.data ?? EMPTY_ORGANIZATIONS}
            isLoading={isPermissionsPending || (canView && query.isPending)}
            isFetching={query.isFetching}
            canManage={canManage}
            isSaving={representativeMutation.isPending}
            onSaveRepresentatives={saveRepresentatives}
          />
          <EpsOrganizationTable
            type="team"
            records={query.data ?? EMPTY_ORGANIZATIONS}
            isLoading={isPermissionsPending || (canView && query.isPending)}
            isFetching={query.isFetching}
            canManage={canManage}
            isSaving={representativeMutation.isPending}
            onSaveRepresentatives={saveRepresentatives}
          />
        </>
      )}
    </div>
  );
}

function EpsOrganizationTable({
  type,
  records,
  isLoading,
  isFetching,
  canManage,
  isSaving,
  onSaveRepresentatives,
}: {
  type: EpsOrganizationType;
  records: EpsOrganization[];
  isLoading: boolean;
  isFetching: boolean;
  canManage: boolean;
  isSaving: boolean;
  onSaveRepresentatives: (
    row: EpsOrganization,
    userIds: string[],
  ) => Promise<void>;
}) {
  const intl = useIntl();
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase('vi');
  const rows = useMemo(() => {
    const matchingType = records.filter((record) => record.type === type);
    if (!normalizedSearch) return matchingType;
    return matchingType.filter((record) =>
      [record.code, record.name, record.parentName].some((value) =>
        value?.toLocaleLowerCase('vi').includes(normalizedSearch),
      ),
    );
  }, [normalizedSearch, records, type]);
  const columns = useEpsOrganizationColumns({
    canManage,
    isSaving,
    onSaveRepresentatives,
  });
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const title = intl.formatMessage({
    id:
      type === 'department'
        ? 'custodians.eps.sections.departments'
        : 'custodians.eps.sections.teams',
  });

  return (
    <DataGrid
      table={table}
      recordCount={rows.length}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyMessage={intl.formatMessage({
        id: normalizedSearch
          ? 'custodians.eps.page.emptySearch'
          : type === 'department'
            ? 'custodians.eps.page.emptyDepartment'
            : 'custodians.eps.page.emptyTeam',
      })}
    >
      <Card className="min-h-[22rem] min-w-0 overflow-hidden">
        <CardHeader className="flex-col items-stretch gap-4 border-b border-border py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="text-xs">
              {intl.formatMessage(
                { id: 'custodians.eps.rowCount' },
                { count: rows.length },
              )}
            </CardDescription>
          </div>
          <CardToolbar className="flex-wrap justify-end">
            <SearchInput
              aria-label={intl.formatMessage({ id: 'custodians.eps.search' })}
              placeholder={intl.formatMessage({ id: 'custodians.eps.search' })}
              value={search}
              onSearch={(value) => {
                setSearch(value);
                table.setPageIndex(0);
              }}
              className="w-64 shrink-0"
            />
            <DataGridHeaderMenu table={table} />
          </CardToolbar>
        </CardHeader>
        <CardTable className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <DataGridTable />
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardTable>
        <CardFooter className="justify-between">
          <DataGridPagination />
        </CardFooter>
      </Card>
    </DataGrid>
  );
}
