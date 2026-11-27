import { useMemo, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import {
  MaterialGroupFilterSidebar,
  MaterialGroupFilterToggle,
} from '@/project/material-groups/components/material-group-filter-tree';
import { useMaterialGroupsQuery } from '@/project/material-groups/hooks/use-material-groups';
import type { MaterialGroup } from '@/project/material-groups/model/material-group';
import { getMaterialGroupDescendantIds } from '@/project/material-groups/model/material-group-tree';
import { useMaterialTableMainColumnWidth } from '@/project/materials/table/use-material-table-main-column-width';
import { FilterCountChips } from '@/project/shared/filter-count-chips';
import { ProjectFilterModeSwitcher } from '@/project/shared/project-filter-mode.generated';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PROJECT_FEATURE_ICONS } from '@/config/project-feature-icons';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
  useDeleteMaterialModelMutation,
  useMaterialModelFilterSummaryQuery,
  useMaterialModelsQuery,
  useUpdateMaterialModelAvailabilityMutation,
} from '../hooks/use-material-models';
import type { MaterialModel } from '../model/material-model';
import { MATERIAL_MODEL_PERMISSION_CODES } from '../model/material-model-permissions';
import {
  MATERIAL_MODEL_COLUMN_PINNING,
  useMaterialModelColumns,
} from '../table/material-model.columns.generated';

const EMPTY_MATERIAL_MODELS: MaterialModel[] = [];
const EMPTY_MATERIAL_GROUPS: MaterialGroup[] = [];

function isAuthorizationError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.response?.status;
  return status === 401 || status === 403;
}

export function MaterialModelsPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = true;
  const canManage = hasPermission(MATERIAL_MODEL_PERMISSION_CODES.manage);
  const query = useMaterialModelsQuery(isPermissionsPending || canView);
  const groupsQuery = useMaterialGroupsQuery(isPermissionsPending || canView);
  const availabilityMutation = useUpdateMaterialModelAvailabilityMutation();
  const deleteMutation = useDeleteMaterialModelMutation();
  const [keyword, setKeyword] = useState('');
  const [groupId, setGroupId] = useState('');
  const [isGroupTreeOpen, setIsGroupTreeOpen] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [inspectionFilter, setInspectionFilter] = useState('');
  const filterModes = [
    {
      value: 'status' as const,
      label: intl.formatMessage({
        id: 'project.management.filters.status',
      }),
    },
    {
      value: 'inspection' as const,
      label: intl.formatMessage({
        id: 'project.management.filters.inspection',
      }),
    },
  ];
  const [selectedFilterMode, setFilterMode] =
    useState<(typeof filterModes)[number]['value']>();
  const filterMode = selectedFilterMode ?? filterModes[0].value;
  const [pendingAvailabilityIds, setPendingAvailabilityIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [deletingModel, setDeletingModel] = useState<MaterialModel | null>(
    null,
  );
  const models = query.data ?? EMPTY_MATERIAL_MODELS;
  const groups = groupsQuery.data ?? EMPTY_MATERIAL_GROUPS;
  const groupIds = useMemo(
    () =>
      groupId ? [...getMaterialGroupDescendantIds(groups, groupId)] : undefined,
    [groupId, groups],
  );
  const summaryQuery = useMaterialModelFilterSummaryQuery(
    { search: keyword.trim(), groupIds },
    !isPermissionsPending && canView,
  );
  const summary = summaryQuery.data;
  const groupNameById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups],
  );
  const filteredModels = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi');
    return models.filter(
      (model) =>
        (!groupIds || groupIds.includes(model.groupId ?? '')) &&
        (!activeFilter || model.isActive === (activeFilter === 'active')) &&
        (!inspectionFilter ||
          model.hasActiveSafetyInspection ===
            (inspectionFilter === 'required')) &&
        (!normalizedKeyword ||
          [model.code, model.name].some((value) =>
            value.toLocaleLowerCase('vi').includes(normalizedKeyword),
          )),
    );
  }, [models, keyword, groupIds, activeFilter, inspectionFilter]);

  const columns = useMaterialModelColumns({
    onEdit: (model) =>
      navigate(buildPath(ROUTES.PROJECT.MATERIAL_MODEL_EDIT, { id: model.id })),
    onDelete: (model) => setDeletingModel(model),
    canManage,
    pendingAvailabilityIds,
    groupNameById,
    onAvailabilityChange: async (model, isActive) => {
      if (!canManage || pendingAvailabilityIds.has(model.id)) return;
      setPendingAvailabilityIds((current) => new Set(current).add(model.id));
      try {
        await availabilityMutation.mutateAsync({ id: model.id, isActive });
        toast.success(
          intl.formatMessage({
            id: isActive
              ? 'materialModels.toasts.activated'
              : 'materialModels.toasts.deactivated',
          }),
        );
      } catch (error) {
        toast.error(getApiErrorMessage(error));
      } finally {
        setPendingAvailabilityIds((current) => {
          const next = new Set(current);
          next.delete(model.id);
          return next;
        });
      }
    },
  });

  const table = useReactTable({
    data: filteredModels,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { columnPinning: MATERIAL_MODEL_COLUMN_PINNING },
  });
  const tableViewportRef = useMaterialTableMainColumnWidth(table);

  const handleDelete = () => {
    if (!canManage || !deletingModel) return;
    deleteMutation.mutate(deletingModel.id, {
      onSuccess: () => {
        toast.success(
          intl.formatMessage(
            { id: 'materialModels.toasts.deleted' },
            { name: deletingModel.name },
          ),
        );
        setDeletingModel(null);
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'materialModels.page.header' })}
        icon={PROJECT_FEATURE_ICONS.materialModels}
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => navigate(ROUTES.PROJECT.MATERIAL_MODEL_CREATE)}
            >
              <Plus />
              {intl.formatMessage({ id: 'materialModels.actions.create' })}
            </Button>
          ) : null
        }
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <MaterialGroupFilterToggle
          isOpen={isGroupTreeOpen}
          controlsId="material-model-group-filter-tree"
          disabled={!canView || isPermissionsPending || groupsQuery.isPending}
          onClick={() => setIsGroupTreeOpen((current) => !current)}
        />
        <ProjectFilterModeSwitcher
          value={filterMode}
          onValueChange={(value) => {
            setFilterMode(
              filterModes.find((option) => option.value === value)?.value,
            );
            setActiveFilter('');
            setInspectionFilter('');
            table.setPageIndex(0);
          }}
          options={filterModes}
          className="shrink-0"
          disabled={!canView || isPermissionsPending}
        />
        <span
          className="hidden h-5 w-px bg-border sm:block"
          aria-hidden="true"
        />

        <FilterCountChips
          ariaLabel={intl.formatMessage({
            id: `project.management.filters.${filterMode}`,
          })}
          value={filterMode === 'status' ? activeFilter : inspectionFilter}
          onValueChange={(value) => {
            if (filterMode === 'status') setActiveFilter(value);
            else setInspectionFilter(value);
            table.setPageIndex(0);
          }}
          disabled={!canView || isPermissionsPending}
          options={
            filterMode === 'status'
              ? [
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
                      id: 'project.management.filters.active',
                    }),
                    count: summary?.active,
                  },
                  {
                    value: 'inactive',
                    label: intl.formatMessage({
                      id: 'project.management.filters.inactive',
                    }),
                    count: summary?.inactive,
                  },
                ]
              : [
                  {
                    value: '',
                    label: intl.formatMessage({
                      id: 'project.management.filters.all',
                    }),
                    count: summary?.total,
                  },
                  {
                    value: 'required',
                    label: intl.formatMessage({
                      id: 'project.management.filters.inspectionRequired',
                    }),
                    count: summary?.requiresInspection,
                  },
                  {
                    value: 'not_required',
                    label: intl.formatMessage({
                      id: 'project.management.filters.inspectionNotRequired',
                    }),
                    count: summary?.notRequiresInspection,
                  },
                ]
          }
        />
      </div>

      <DataGrid
        table={table}
        recordCount={filteredModels.length}
        isLoading={
          isPermissionsPending ||
          (canView && (query.isPending || groupsQuery.isPending))
        }
        isFetching={query.isFetching || groupsQuery.isFetching}
        emptyMessage={intl.formatMessage({
          id:
            keyword || groupId || activeFilter || inspectionFilter
              ? 'materialModels.empty.search'
              : 'materialModels.empty.list',
        })}
        tableLayout={{ dense: true }}
      >
        <div
          className={`flex min-h-0 min-w-0 flex-1 flex-col transition-[gap] duration-300 ease-in-out motion-reduce:transition-none xl:flex-row ${isGroupTreeOpen ? 'gap-3' : 'gap-0'}`}
        >
          <MaterialGroupFilterSidebar
            id="material-model-group-filter-tree"
            isOpen={isGroupTreeOpen}
            groups={groups}
            countMode="models"
            selectedGroupId={groupId || null}
            onSelectGroup={(nextGroupId) => {
              setGroupId(nextGroupId ?? '');
              table.setPageIndex(0);
            }}
          />
          <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
            <DataGridHeader
              variant="stats"
              recordCountLabel="mẫu vật tư"
              stats={
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <SearchInput
                      aria-label={intl.formatMessage({
                        id: 'materialModels.filters.searchPlaceholder',
                      })}
                      placeholder={intl.formatMessage({
                        id: 'materialModels.filters.searchPlaceholder',
                      })}
                      value={keyword}
                      onSearch={(value) => {
                        setKeyword(value);
                        table.setPageIndex(0);
                      }}
                      className="w-full sm:w-64"
                    />
                  </div>
                </div>
              }
              toolbar={<DataGridHeaderMenu table={table} />}
            />

            <CardTable className="min-h-0 flex-1">
              {!isPermissionsPending && !canView ? (
                <ErrorState
                  title={intl.formatMessage({
                    id: 'materialModels.errors.authorizationTitle',
                  })}
                  description={intl.formatMessage({
                    id: 'materialModels.errors.authorization',
                  })}
                />
              ) : query.isError || groupsQuery.isError ? (
                <ErrorState
                  title={intl.formatMessage({
                    id: 'materialModels.errors.loadTitle',
                  })}
                  description={
                    isAuthorizationError(query.error ?? groupsQuery.error)
                      ? intl.formatMessage({
                          id: 'materialModels.errors.authorization',
                        })
                      : getApiErrorMessage(query.error ?? groupsQuery.error)
                  }
                  onRetry={() => {
                    void query.refetch();
                    void groupsQuery.refetch();
                  }}
                />
              ) : (
                <ScrollArea className="h-full" viewportRef={tableViewportRef}>
                  <DataGridTable />
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </CardTable>

            <CardFooter className="justify-between">
              {canView &&
              !isPermissionsPending &&
              !query.isError &&
              !groupsQuery.isError ? (
                <DataGridPagination />
              ) : null}
            </CardFooter>
          </Card>
        </div>
      </DataGrid>

      <ConfirmDialog
        open={deletingModel !== null}
        onOpenChange={(open) => !open && setDeletingModel(null)}
        title={intl.formatMessage({ id: 'materialModels.dialogs.deleteTitle' })}
        description={intl.formatMessage(
          { id: 'materialModels.dialogs.deleteDescription' },
          { name: deletingModel?.name ?? '' },
        )}
        confirmLabel={intl.formatMessage({
          id: 'materialModels.dialogs.deleteConfirm',
        })}
        confirmVariant="destructive"
        isConfirming={deleteMutation.isPending}
        closeOnConfirm={false}
        onConfirm={handleDelete}
      />
    </div>
  );
}
