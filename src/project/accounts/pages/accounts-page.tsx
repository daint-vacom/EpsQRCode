import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Plus, UsersRound } from 'lucide-react';
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
import type { MultiSelectOption } from '@/components/ui/multi-select';
import { OptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  createAccount,
  loadAccountRoleOptions,
  loadAccounts,
  loadAccountWarehouseOptions,
  loadExternalOrganizations,
  loadFakeEpsDirectory,
  saveAccountAccess,
} from '../api/accounts.api';
import {
  AccountFormDialog,
  mapAccountToFormValues,
  useAccountForm,
} from '../forms/account-form.generated';
import {
  ACCOUNT_PERMISSION_CODES,
  accountDefaultValues,
  type Account,
  type AccountFormValues,
} from '../model/account';
import {
  ACCOUNT_COLUMN_PINNING,
  useAccountColumns,
} from '../table/account.columns.generated';

interface AccountFormOptions {
  epsEmployees: Awaited<ReturnType<typeof loadFakeEpsDirectory>>;
  externalOrganizations: Awaited<ReturnType<typeof loadExternalOrganizations>>;
  roles: Awaited<ReturnType<typeof loadAccountRoleOptions>>;
  warehouses: Awaited<ReturnType<typeof loadAccountWarehouseOptions>>;
}

const EMPTY_ACCOUNTS: Account[] = [];
const NO_FILTER = 'all';

export function AccountsPage() {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const { userId, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(ACCOUNT_PERMISSION_CODES.view);
  const canManage = hasPermission(ACCOUNT_PERMISSION_CODES.manage);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    type: NO_FILTER,
    status: NO_FILTER,
    organization: NO_FILTER,
    role: NO_FILTER,
    warehouse: NO_FILTER,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const createForm = useAccountForm({ defaultValues: accountDefaultValues });
  const editForm = useAccountForm({ defaultValues: accountDefaultValues });

  const accountsQuery = useQuery({
    queryKey: ['project', 'accounts', 'list', search],
    queryFn: () => loadAccounts(search),
    enabled: Boolean(userId) && !isPermissionsPending && canView,
  });
  const optionsQuery = useQuery({
    queryKey: ['project', 'accounts', 'form-options'],
    queryFn: async (): Promise<AccountFormOptions> => {
      const [epsEmployees, externalOrganizations, roles, warehouses] =
        await Promise.all([
          loadFakeEpsDirectory(),
          loadExternalOrganizations(true),
          loadAccountRoleOptions(),
          loadAccountWarehouseOptions(),
        ]);
      return { epsEmployees, externalOrganizations, roles, warehouses };
    },
    enabled: Boolean(userId) && !isPermissionsPending && canManage,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (input: {
      userId: string | null;
      values: AccountFormValues;
    }) => {
      if (input.userId) return saveAccountAccess(input.userId, input.values);
      return createAccount(input.values);
    },
    onSuccess: async (_result, input) => {
      toast.success(
        intl.formatMessage({
          id: input.userId
            ? 'accounts.toasts.updated'
            : 'accounts.toasts.created',
        }),
      );
      if (input.userId) setEditing(null);
      else {
        setCreateOpen(false);
        createForm.reset(accountDefaultValues);
      }
      await queryClient.invalidateQueries({
        queryKey: ['project', 'accounts'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['project', 'my-qrcode-account'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['project', 'global-search'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const accountOptions = optionsQuery.data;
  const epsEmployeeIdOptions: SelectOption[] = (
    accountOptions?.epsEmployees ?? []
  ).map((employee) => {
    return {
      value: employee.id,
      label: `${employee.display_name} · ${employee.employee_code} — ${employee.department_name}${employee.team_name ? ` / ${employee.team_name}` : ''}`,
      disabled:
        employee.employment_status !== 'active' ||
        (employee.linked_user_id !== null &&
          employee.linked_user_id !== editing?.userId),
    };
  });
  const externalOrganizationIdOptions: SelectOption[] = (
    accountOptions?.externalOrganizations ?? []
  ).map((organization) => ({
    value: organization.id,
    label: `${organization.name} · ${organization.code}`,
    disabled: !organization.is_active,
  }));
  const roleIdsOptions: MultiSelectOption[] = (accountOptions?.roles ?? []).map(
    (role) => ({
      value: role.id,
      label: role.name,
      disabled: role.is_system,
    }),
  );
  const warehouseIdsOptions: MultiSelectOption[] = (
    accountOptions?.warehouses ?? []
  ).map((warehouse) => ({
    value: warehouse.id,
    label: `${warehouse.name} · ${warehouse.code}`,
  }));

  const filterOptions = useMemo(() => {
    const organizations = new Map<string, string>();
    const roles = new Map<string, string>();
    const warehouses = new Map<string, string>();
    for (const account of accountsQuery.data ?? EMPTY_ACCOUNTS) {
      const organizationId =
        account.externalOrganizationId ?? account.epsDepartmentId;
      const organizationName =
        account.externalOrganizationName ?? account.epsDepartmentName;
      if (organizationId && organizationName)
        organizations.set(organizationId, organizationName);
      account.roleIds.forEach((id, index) => {
        const name = account.roleNames[index];
        if (name) roles.set(id, name);
      });
      account.warehouseIds.forEach((id, index) => {
        const name = account.warehouseNames[index];
        if (name) warehouses.set(id, name);
      });
    }
    const sortOptions = (values: Map<string, string>): SelectOption[] =>
      [...values]
        .sort((left, right) => left[1].localeCompare(right[1], 'vi'))
        .map(([value, label]) => ({ value, label }));
    return {
      types: [
        {
          value: NO_FILTER,
          label: intl.formatMessage({ id: 'accounts.filters.allTypes' }),
        },
        ...(['eps', 'external', 'unmapped'] as const).map((value) => ({
          value,
          label: intl.formatMessage({ id: `accounts.types.${value}` }),
        })),
      ],
      statuses: [
        {
          value: NO_FILTER,
          label: intl.formatMessage({ id: 'accounts.filters.allStatuses' }),
        },
        ...(['active', 'suspended', 'deactivated'] as const).map((value) => ({
          value,
          label: intl.formatMessage({ id: `accounts.status.${value}` }),
        })),
      ],
      organizations: [
        {
          value: NO_FILTER,
          label: intl.formatMessage({
            id: 'accounts.filters.allOrganizations',
          }),
        },
        ...sortOptions(organizations),
      ],
      roles: [
        {
          value: NO_FILTER,
          label: intl.formatMessage({ id: 'accounts.filters.allRoles' }),
        },
        ...sortOptions(roles),
      ],
      warehouses: [
        {
          value: NO_FILTER,
          label: intl.formatMessage({ id: 'accounts.filters.allWarehouses' }),
        },
        ...sortOptions(warehouses),
      ],
    } satisfies Record<string, SelectOption[]>;
  }, [accountsQuery.data, intl]);

  const filteredAccounts = useMemo(
    () =>
      (accountsQuery.data ?? EMPTY_ACCOUNTS).filter((account) => {
        const organizationId =
          account.externalOrganizationId ?? account.epsDepartmentId;
        return (
          (filters.type === NO_FILTER ||
            account.accountType === filters.type) &&
          (filters.status === NO_FILTER || account.status === filters.status) &&
          (filters.organization === NO_FILTER ||
            organizationId === filters.organization) &&
          (filters.role === NO_FILTER ||
            account.roleIds.includes(filters.role)) &&
          (filters.warehouse === NO_FILTER ||
            account.warehouseIds.includes(filters.warehouse))
        );
      }),
    [accountsQuery.data, filters],
  );
  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== NO_FILTER,
  );

  const openEdit = (account: Account) => {
    if (!canManage) return;
    setEditing(account);
    editForm.reset(mapAccountToFormValues(account));
  };
  const columns = useAccountColumns({ canManage, onEdit: openEdit });
  const table = useReactTable({
    data: filteredAccounts,
    columns,
    getRowId: (row) => row.userId,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { columnPinning: ACCOUNT_COLUMN_PINNING },
  });

  const submit = (userId: string | null, values: AccountFormValues) => {
    if (!canManage) return;
    saveMutation.mutate({ userId, values });
  };

  const pageHeader = (
    <PageHeader
      title={intl.formatMessage({ id: 'accounts.page.title' })}
      icon={UsersRound}
      actions={
        canManage ? (
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={optionsQuery.isPending || optionsQuery.isError}
            onClick={() => setCreateOpen(true)}
          >
            <Plus />
            {intl.formatMessage({ id: 'accounts.actions.create' })}
          </Button>
        ) : null
      }
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      {pageHeader}
      {canManage && optionsQuery.isError ? (
        <ErrorState
          title={intl.formatMessage({ id: 'accounts.page.loadError' })}
          description={getApiErrorMessage(optionsQuery.error)}
          onRetry={() => void optionsQuery.refetch()}
        />
      ) : null}
      <DataGrid
        table={table}
        recordCount={filteredAccounts.length}
        isLoading={
          isPermissionsPending ||
          (canView && accountsQuery.isPending) ||
          (canManage && optionsQuery.isPending)
        }
        isFetching={accountsQuery.isFetching}
        emptyMessage={intl.formatMessage({
          id: search.trim()
            ? 'accounts.page.emptySearch'
            : hasActiveFilters
              ? 'accounts.page.emptyFilter'
              : 'accounts.page.empty',
        })}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel={intl.formatMessage({ id: 'accounts.page.title' })}
            stats={
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                  aria-label={intl.formatMessage({ id: 'accounts.search' })}
                  placeholder={intl.formatMessage({ id: 'accounts.search' })}
                  value={search}
                  onSearch={(value) => {
                    setSearch(value);
                    table.setPageIndex(0);
                  }}
                  className="w-64 shrink-0"
                />
                <OptionSelect
                  ariaLabel={intl.formatMessage({
                    id: 'accounts.filters.type',
                  })}
                  value={filters.type}
                  options={filterOptions.types}
                  onChange={(value) => {
                    setFilters((current) => ({ ...current, type: value }));
                    table.setPageIndex(0);
                  }}
                  className="w-36 shrink-0"
                  searchable={false}
                />
                <OptionSelect
                  ariaLabel={intl.formatMessage({
                    id: 'accounts.filters.status',
                  })}
                  value={filters.status}
                  options={filterOptions.statuses}
                  onChange={(value) => {
                    setFilters((current) => ({ ...current, status: value }));
                    table.setPageIndex(0);
                  }}
                  className="w-40 shrink-0"
                  searchable={false}
                />
                <OptionSelect
                  ariaLabel={intl.formatMessage({
                    id: 'accounts.filters.organization',
                  })}
                  value={filters.organization}
                  options={filterOptions.organizations}
                  onChange={(value) => {
                    setFilters((current) => ({
                      ...current,
                      organization: value,
                    }));
                    table.setPageIndex(0);
                  }}
                  className="w-44 shrink-0"
                />
                <OptionSelect
                  ariaLabel={intl.formatMessage({
                    id: 'accounts.filters.role',
                  })}
                  value={filters.role}
                  options={filterOptions.roles}
                  onChange={(value) => {
                    setFilters((current) => ({ ...current, role: value }));
                    table.setPageIndex(0);
                  }}
                  className="w-40 shrink-0"
                />
                <OptionSelect
                  ariaLabel={intl.formatMessage({
                    id: 'accounts.filters.warehouse',
                  })}
                  value={filters.warehouse}
                  options={filterOptions.warehouses}
                  onChange={(value) => {
                    setFilters((current) => ({ ...current, warehouse: value }));
                    table.setPageIndex(0);
                  }}
                  className="w-40 shrink-0"
                />
              </div>
            }
            toolbar={<DataGridHeaderMenu table={table} />}
          />
          <CardTable className="min-h-0 flex-1">
            {!isPermissionsPending && !canView ? (
              <ErrorState
                title={intl.formatMessage({ id: 'accounts.page.noView' })}
                description={intl.formatMessage({ id: 'accounts.page.noView' })}
              />
            ) : accountsQuery.isError ? (
              <ErrorState
                title={intl.formatMessage({ id: 'accounts.page.loadError' })}
                description={getApiErrorMessage(accountsQuery.error)}
                onRetry={() => void accountsQuery.refetch()}
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
            {canView && !isPermissionsPending && !accountsQuery.isError ? (
              <DataGridPagination />
            ) : null}
          </CardFooter>
        </Card>
      </DataGrid>

      {accountOptions ? (
        <>
          <AccountFormDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            mode="create"
            form={createForm}
            onSubmit={(values) => submit(null, values)}
            isSaving={saveMutation.isPending}
            epsEmployeeIdOptions={epsEmployeeIdOptions}
            externalOrganizationIdOptions={externalOrganizationIdOptions}
            roleIdsOptions={roleIdsOptions}
            warehouseIdsOptions={warehouseIdsOptions}
            title={intl.formatMessage({ id: 'accounts.dialog.createTitle' })}
          />
          <AccountFormDialog
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            mode="edit"
            form={editForm}
            onSubmit={(values) => editing && submit(editing.userId, values)}
            isSaving={saveMutation.isPending}
            epsEmployeeIdOptions={epsEmployeeIdOptions}
            externalOrganizationIdOptions={externalOrganizationIdOptions}
            roleIdsOptions={roleIdsOptions}
            warehouseIdsOptions={warehouseIdsOptions}
            title={intl.formatMessage({ id: 'accounts.dialog.editTitle' })}
          />
        </>
      ) : null}
    </div>
  );
}
