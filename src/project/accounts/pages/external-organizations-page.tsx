import { useMemo, useState } from 'react';
import { replaceCustodianRepresentatives } from '@/project/custodians/api/custodians.api';
import { FilterCountChips } from '@/project/shared/filter-count-chips';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Building2, Plus } from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridHeaderMenu } from '@/components/ui/data-grid-header-menu';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/inputs/search-input';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  loadExternalOrganizationFilterSummary,
  loadExternalOrganizations,
  saveExternalOrganization,
} from '../api/accounts.api';
import {
  ExternalOrganizationFormDialog,
  useExternalOrganizationForm,
} from '../forms/external-organization-form.generated';
import {
  ACCOUNT_PERMISSION_CODES,
  type ExternalOrganization,
  type ExternalOrganizationFormValues,
} from '../model/account';
import { useExternalOrganizationColumns } from '../table/external-organization.columns.generated';

const EMPTY_ORGANIZATIONS: ExternalOrganization[] = [];
const emptyFormValues: ExternalOrganizationFormValues = {
  code: '',
  name: '',
  isActive: true,
};

export function ExternalOrganizationsPage() {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const { hasPermission, userId } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView =
    hasPermission(ACCOUNT_PERMISSION_CODES.externalView) ||
    hasPermission(ACCOUNT_PERMISSION_CODES.externalManage) ||
    hasPermission(ACCOUNT_PERMISSION_CODES.view) ||
    hasPermission(ACCOUNT_PERMISSION_CODES.manage);
  const canManage = hasPermission(ACCOUNT_PERMISSION_CODES.externalManage);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalOrganization | null>(null);
  const createForm = useExternalOrganizationForm({
    defaultValues: emptyFormValues,
  });
  const editForm = useExternalOrganizationForm({
    defaultValues: emptyFormValues,
  });
  const query = useQuery({
    queryKey: ['project', 'external-organizations'],
    queryFn: () => loadExternalOrganizations(true),
    enabled: !isPermissionsPending && canView,
  });
  const summaryQuery = useQuery({
    queryKey: [
      'project',
      'external-organizations',
      'filter-summary',
      userId,
      search.trim(),
    ],
    queryFn: ({ signal }) =>
      loadExternalOrganizationFilterSummary(search.trim(), signal),
    enabled: !isPermissionsPending && canView,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[3] === userId ? previousData : undefined,
    retry: 0,
  });
  const summary = summaryQuery.data;
  const saveMutation = useMutation({
    mutationFn: (input: {
      id: string | null;
      values: ExternalOrganizationFormValues;
    }) => saveExternalOrganization(input.id, input.values),
    onSuccess: async (_result, input) => {
      toast.success(
        intl.formatMessage({
          id: input.id
            ? 'accounts.external.toasts.updated'
            : 'accounts.external.toasts.created',
        }),
      );
      if (input.id) setEditing(null);
      else {
        setCreateOpen(false);
        createForm.reset(emptyFormValues);
      }
      await queryClient.invalidateQueries({
        queryKey: ['project', 'external-organizations'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['project', 'accounts', 'form-options'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['project', 'accounts'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const representativeMutation = useMutation({
    mutationFn: (input: { id: string; userIds: string[] }) =>
      replaceCustodianRepresentatives(input.id, input.userIds),
    onSuccess: async () => {
      toast.success(
        intl.formatMessage({
          id: 'accounts.external.toasts.representativesUpdated',
        }),
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['project', 'external-organizations'],
        }),
        queryClient.invalidateQueries({ queryKey: ['project', 'custodians'] }),
      ]);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const normalizedSearch = search.trim().toLocaleLowerCase('vi');
  const organizations = useMemo(() => {
    const records = query.data ?? EMPTY_ORGANIZATIONS;
    return records.filter(
      (record) =>
        (!activeFilter || record.is_active === (activeFilter === 'active')) &&
        (!normalizedSearch ||
          [record.code, record.name].some((value) =>
            value.toLocaleLowerCase('vi').includes(normalizedSearch),
          )),
    );
  }, [normalizedSearch, query.data, activeFilter]);
  const openEdit = (organization: ExternalOrganization) => {
    if (!canManage) return;
    setEditing(organization);
    editForm.reset({
      code: organization.code,
      name: organization.name,
      isActive: organization.is_active,
    });
  };
  const columns = useExternalOrganizationColumns({
    canManage,
    isSavingRepresentatives: representativeMutation.isPending,
    onEdit: openEdit,
    onSaveRepresentatives: (organization, userIds) =>
      representativeMutation.mutateAsync({ id: organization.id, userIds }),
  });
  const table = useReactTable({
    data: organizations,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const submit = (
    id: string | null,
    values: ExternalOrganizationFormValues,
  ) => {
    if (canManage) saveMutation.mutate({ id, values });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'accounts.external.page.title' })}
        icon={Building2}
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
            >
              <Plus />
              {intl.formatMessage({ id: 'accounts.external.actions.create' })}
            </Button>
          ) : null
        }
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <FilterCountChips
          ariaLabel={intl.formatMessage({
            id: 'project.management.filters.status',
          })}
          value={activeFilter}
          onValueChange={(value) => {
            setActiveFilter(value);
            table.setPageIndex(0);
          }}
          disabled={!canView || isPermissionsPending}
          options={[
            {
              value: '',
              label: intl.formatMessage({
                id: 'project.management.filters.all',
              }),
              count: summary?.total,
            },
            {
              value: 'active',
              label: intl.formatMessage({
                id: 'accounts.external.status.active',
              }),
              count: summary?.active,
            },
            {
              value: 'inactive',
              label: intl.formatMessage({
                id: 'accounts.external.status.inactive',
              }),
              count: summary?.inactive,
            },
          ]}
        />
      </div>
      <DataGrid
        table={table}
        recordCount={organizations.length}
        isLoading={isPermissionsPending || (canView && query.isPending)}
        isFetching={query.isFetching}
        emptyMessage={intl.formatMessage({
          id:
            normalizedSearch || activeFilter
              ? 'accounts.external.page.emptySearch'
              : 'accounts.external.page.empty',
        })}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel={intl.formatMessage({
              id: 'accounts.external.page.title',
            })}
            stats={
              <div className="flex min-w-0 flex-col gap-2">
                <SearchInput
                  aria-label={intl.formatMessage({
                    id: 'accounts.external.search',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'accounts.external.search',
                  })}
                  value={search}
                  onSearch={(value) => {
                    setSearch(value);
                    table.setPageIndex(0);
                  }}
                  className="w-72 shrink-0"
                />
              </div>
            }
            toolbar={<DataGridHeaderMenu table={table} />}
          />
          <CardTable className="min-h-0 flex-1">
            {!isPermissionsPending && !canView ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'accounts.external.page.noView',
                })}
                description={intl.formatMessage({
                  id: 'accounts.external.page.noView',
                })}
              />
            ) : query.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'accounts.external.page.loadError',
                })}
                description={getApiErrorMessage(query.error)}
                onRetry={() => void query.refetch()}
                retryLabel={intl.formatMessage({ id: 'common.actions.retry' })}
              />
            ) : (
              <ScrollArea className="h-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardTable>
          <CardFooter className="justify-between">
            {canView && !isPermissionsPending && !query.isError ? (
              <DataGridPagination />
            ) : null}
          </CardFooter>
        </Card>
      </DataGrid>

      <ExternalOrganizationFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        form={createForm}
        onSubmit={(values) => submit(null, values)}
        isSaving={saveMutation.isPending}
        title={intl.formatMessage({
          id: 'accounts.external.dialog.createTitle',
        })}
      />
      <ExternalOrganizationFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        form={editForm}
        onSubmit={(values) => editing && submit(editing.id, values)}
        isSaving={saveMutation.isPending}
        title={intl.formatMessage({
          id: 'accounts.external.dialog.editTitle',
        })}
      />
    </div>
  );
}
