import { useMemo, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import { useMaterialGroupsQuery } from '@/project/material-groups/hooks/use-material-groups';
import { useMaterialModelsQuery } from '@/project/material-models/hooks/use-material-models';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
} from '@tanstack/react-table';
import { Boxes, Plus } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
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
import { Input } from '@/components/ui/input';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useMaterialsQuery } from '../hooks/use-materials';
import type {
  MaterialCondition,
  MaterialListFilters,
  MaterialStatus,
} from '../model/material';
import { MATERIAL_PERMISSION_CODES } from '../model/material-permissions';
import {
  MATERIAL_COLUMN_PINNING,
  useMaterialColumns,
} from '../table/material.columns.generated';

const DEFAULT_PAGE_SIZE = 25;

export function MaterialListPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const [search, setSearch] = useState('');
  const [modelId, setModelId] = useState('');
  const [ownerPartyId, setOwnerPartyId] = useState('');
  const [borrowerPartyId, setBorrowerPartyId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [status, setStatus] = useState('');
  const [condition, setCondition] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const filters = useMemo<MaterialListFilters>(
    () => ({
      search: search.trim() || undefined,
      modelId: modelId || undefined,
      ownerPartyId: ownerPartyId || undefined,
      borrowerPartyId: borrowerPartyId || undefined,
      groupId: groupId || undefined,
      status: (status || undefined) as MaterialStatus | undefined,
      condition: (condition || undefined) as MaterialCondition | undefined,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    }),
    [
      borrowerPartyId,
      condition,
      groupId,
      modelId,
      ownerPartyId,
      pagination.pageIndex,
      pagination.pageSize,
      search,
      status,
    ],
  );
  const queryEnabled = isPermissionsPending || canView;
  const query = useMaterialsQuery(
    filters,
    queryEnabled && !isPermissionsPending,
  );
  const modelsQuery = useMaterialModelsQuery(
    queryEnabled && !isPermissionsPending,
  );
  const partiesQuery = useCustodiansQuery(
    false,
    queryEnabled && !isPermissionsPending,
  );
  const groupsQuery = useMaterialGroupsQuery(
    queryEnabled && !isPermissionsPending,
  );
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const partyNameById = useMemo(
    () =>
      new Map((partiesQuery.data ?? []).map((party) => [party.id, party.name])),
    [partiesQuery.data],
  );
  const columns = useMaterialColumns({
    partyNameById,
    canManage,
    onView: (material) =>
      window.open(
        buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, { id: material.id }),
        '_blank',
        'noopener,noreferrer',
      ),
    onEdit: (material) =>
      navigate(buildPath(ROUTES.PROJECT.MATERIAL_EDIT, { id: material.id })),
  });
  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    rowCount: total,
    state: { pagination, columnPinning: MATERIAL_COLUMN_PINNING },
    onPaginationChange: setPagination,
  });
  const modelOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: '',
        label: intl.formatMessage({ id: 'project.materials.filters.model' }),
      },
      ...(modelsQuery.data ?? [])
        .filter((model) => model.isActive)
        .map((model) => ({
          value: model.id,
          label: `${model.code} · ${model.name}`,
        })),
    ],
    [intl, modelsQuery.data],
  );
  const ownerOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: '',
        label: intl.formatMessage({ id: 'project.materials.filters.owner' }),
      },
      ...(partiesQuery.data ?? [])
        .filter((party) => party.isActive)
        .map((party) => ({
          value: party.id,
          label: `${party.name} · ${party.code}`,
        })),
    ],
    [intl, partiesQuery.data],
  );
  const borrowerOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: '',
        label: intl.formatMessage({ id: 'project.materials.filters.borrower' }),
      },
      ...(partiesQuery.data ?? [])
        .filter((party) => party.isActive)
        .map((party) => ({
          value: party.id,
          label: `${party.name} · ${party.code}`,
        })),
    ],
    [intl, partiesQuery.data],
  );
  const groupOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: '',
        label: intl.formatMessage({ id: 'project.materials.filters.group' }),
      },
      ...(groupsQuery.data ?? [])
        .filter((group) => group.isActive)
        .map((group) => ({
          value: group.id,
          label: `${group.code} · ${group.name}`,
        })),
    ],
    [groupsQuery.data, intl],
  );
  const statusOptions: SelectOption[] = [
    {
      value: '',
      label: intl.formatMessage({ id: 'project.materials.filters.status' }),
    },
    {
      value: 'available',
      label: intl.formatMessage({ id: 'project.materials.status.available' }),
    },
    {
      value: 'loaned',
      label: intl.formatMessage({ id: 'project.materials.status.loaned' }),
    },
  ];
  const conditionOptions: SelectOption[] = [
    {
      value: '',
      label: intl.formatMessage({ id: 'project.materials.filters.condition' }),
    },
    {
      value: 'good',
      label: intl.formatMessage({ id: 'project.materials.condition.good' }),
    },
    {
      value: 'damaged',
      label: intl.formatMessage({ id: 'project.materials.condition.damaged' }),
    },
  ];
  const handleFilterChange =
    (setValue: (value: string) => void) => (value: string) => {
      setValue(value);
      setPagination((current) => ({ ...current, pageIndex: 0 }));
    };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'project.materials.page.title' })}
        icon={Boxes}
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => navigate(ROUTES.PROJECT.MATERIAL_CREATE)}
            >
              <Plus />
              {intl.formatMessage({ id: 'project.materials.actions.create' })}
            </Button>
          ) : null
        }
      />
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={isPermissionsPending || (canView && query.isPending)}
        isFetching={query.isFetching}
        emptyMessage={intl.formatMessage({
          id: search
            ? 'project.materials.empty.search'
            : 'project.materials.empty.list',
        })}
        tableLayout={{ dense: true }}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel={intl.formatMessage({
              id: 'project.materials.list.recordCountLabel',
            })}
            stats={
              <>
                <Input
                  aria-label={intl.formatMessage({
                    id: 'project.materials.filters.search',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'project.materials.filters.search',
                  })}
                  value={search}
                  className="w-full sm:w-64"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPagination((current) => ({ ...current, pageIndex: 0 }));
                  }}
                />
                <OptionSelect
                  options={modelOptions}
                  value={modelId}
                  onChange={handleFilterChange(setModelId)}
                  searchable
                />
                <OptionSelect
                  options={groupOptions}
                  value={groupId}
                  onChange={handleFilterChange(setGroupId)}
                  searchable
                />
                <OptionSelect
                  options={ownerOptions}
                  value={ownerPartyId}
                  onChange={handleFilterChange(setOwnerPartyId)}
                  searchable
                />
                <OptionSelect
                  options={borrowerOptions}
                  value={borrowerPartyId}
                  onChange={handleFilterChange(setBorrowerPartyId)}
                  searchable
                />
                <OptionSelect
                  options={statusOptions}
                  value={status}
                  onChange={handleFilterChange(setStatus)}
                />
                <OptionSelect
                  options={conditionOptions}
                  value={condition}
                  onChange={handleFilterChange(setCondition)}
                />
              </>
            }
            toolbar={<DataGridHeaderMenu table={table} />}
          />
          <CardTable className="min-h-0 flex-1">
            {!isPermissionsPending && !canView ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.materials.errors.loadTitle',
                })}
                description={intl.formatMessage({
                  id: 'project.materials.errors.authorization',
                })}
              />
            ) : query.isError ||
              modelsQuery.isError ||
              partiesQuery.isError ||
              groupsQuery.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: query.isError
                    ? 'project.materials.errors.loadTitle'
                    : 'project.materials.errors.loadFiltersTitle',
                })}
                description={getApiErrorMessage(
                  query.error ??
                    modelsQuery.error ??
                    partiesQuery.error ??
                    groupsQuery.error,
                )}
                onRetry={() => {
                  void query.refetch();
                  void modelsQuery.refetch();
                  void partiesQuery.refetch();
                  void groupsQuery.refetch();
                }}
              />
            ) : (
              <ScrollArea className="h-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardTable>
          <CardFooter className="justify-between">
            {canView &&
            !isPermissionsPending &&
            !query.isError &&
            !modelsQuery.isError &&
            !partiesQuery.isError &&
            !groupsQuery.isError ? (
              <DataGridPagination />
            ) : null}
          </CardFooter>
        </Card>
      </DataGrid>
    </div>
  );
}
