import { useMemo, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useMaterialGroupsQuery } from '@/project/material-groups/hooks/use-material-groups';
import { useMaterialTableMainColumnWidth } from '@/project/materials/table/use-material-table-main-column-width';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Boxes, Plus } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
  const canView = hasPermission(MATERIAL_MODEL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_MODEL_PERMISSION_CODES.manage);
  const query = useMaterialModelsQuery(isPermissionsPending || canView);
  const groupsQuery = useMaterialGroupsQuery(isPermissionsPending || canView);
  const availabilityMutation = useUpdateMaterialModelAvailabilityMutation();
  const deleteMutation = useDeleteMaterialModelMutation();
  const [keyword, setKeyword] = useState('');
  const [pendingAvailabilityIds, setPendingAvailabilityIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [deletingModel, setDeletingModel] = useState<MaterialModel | null>(
    null,
  );
  const models = query.data ?? EMPTY_MATERIAL_MODELS;
  const groupNameById = useMemo(
    () =>
      new Map((groupsQuery.data ?? []).map((group) => [group.id, group.name])),
    [groupsQuery.data],
  );
  const filteredModels = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi');
    if (!normalizedKeyword) return models;
    return models.filter((model) =>
      [model.code, model.name].some((value) =>
        value.toLocaleLowerCase('vi').includes(normalizedKeyword),
      ),
    );
  }, [models, keyword]);

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
        icon={Boxes}
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

      <DataGrid
        table={table}
        recordCount={filteredModels.length}
        isLoading={
          isPermissionsPending ||
          (canView && (query.isPending || groupsQuery.isPending))
        }
        isFetching={query.isFetching || groupsQuery.isFetching}
        emptyMessage={intl.formatMessage({
          id: keyword
            ? 'materialModels.empty.search'
            : 'materialModels.empty.list',
        })}
        tableLayout={{ dense: true }}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel="mẫu vật tư"
            stats={
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
