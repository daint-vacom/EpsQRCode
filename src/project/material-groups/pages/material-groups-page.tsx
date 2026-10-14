import { useMemo, useState } from 'react';
import { useCodeGenerationPatternsQuery } from '@/project/code-generation/hooks/use-code-generation-patterns';
import { DEFAULT_CODE_GENERATION_PATTERNS } from '@/project/code-generation/model/code-pattern-example';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Columns3Cog, PackageOpen, Plus, RefreshCw } from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnVisibility } from '@/components/ui/data-grid-column-visibility';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  mapMaterialGroupToFormValues,
  MaterialGroupFormDialog,
  useMaterialGroupForm,
} from '../forms/material-group-form.generated';
import {
  useCreateMaterialGroupMutation,
  useDeleteMaterialGroupMutation,
  useMaterialGroupsQuery,
  useUpdateMaterialGroupAvailabilityMutation,
  useUpdateMaterialGroupMutation,
} from '../hooks/use-material-groups';
import type { MaterialGroup } from '../model/material-group';
import { MATERIAL_GROUP_PERMISSION_CODES } from '../model/material-group-permissions';
import {
  MATERIAL_GROUP_COLUMN_PINNING,
  useMaterialGroupColumns,
} from '../table/material-group.columns.generated';
import { MaterialGroupFilterBar } from '../table/material-group.filters.generated';

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

export function MaterialGroupsPage() {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_GROUP_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_GROUP_PERMISSION_CODES.manage);
  const codePatternsQuery = useCodeGenerationPatternsQuery(
    !isPermissionsPending && canManage,
  );
  const codePattern =
    codePatternsQuery.data?.find((item) => item.entityKey === 'material_group')
      ?.pattern ?? DEFAULT_CODE_GENERATION_PATTERNS.material_group;
  const query = useMaterialGroupsQuery(isPermissionsPending || canView);
  const createMutation = useCreateMaterialGroupMutation();
  const updateMutation = useUpdateMaterialGroupMutation();
  const availabilityMutation = useUpdateMaterialGroupAvailabilityMutation();
  const deleteMutation = useDeleteMaterialGroupMutation();
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pendingAvailabilityIds, setPendingAvailabilityIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [editingGroup, setEditingGroup] = useState<MaterialGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<MaterialGroup | null>(
    null,
  );
  const createForm = useMaterialGroupForm();
  const editForm = useMaterialGroupForm();

  const groups = query.data ?? EMPTY_MATERIAL_GROUPS;
  const filteredGroups = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi');
    if (!normalizedKeyword) return groups;
    return groups.filter((group) =>
      [group.code, group.name, group.description].some((value) =>
        value.toLocaleLowerCase('vi').includes(normalizedKeyword),
      ),
    );
  }, [groups, keyword]);

  const openEdit = (group: MaterialGroup) => {
    if (!canManage) return;
    setEditingGroup(group);
    editForm.reset(mapMaterialGroupToFormValues(group));
    setEditOpen(true);
  };

  const columns = useMaterialGroupColumns({
    onEdit: openEdit,
    onDelete: (group) => {
      if (canManage) setDeletingGroup(group);
    },
    canEdit: canManage,
    canDelete: canManage,
    canManage,
    onAvailabilityChange: async (group, isActive) => {
      if (!canManage || pendingAvailabilityIds.has(group.id)) return;
      setPendingAvailabilityIds((current) => new Set(current).add(group.id));
      try {
        await availabilityMutation.mutateAsync({ id: group.id, isActive });
        toast.success(
          intl.formatMessage({
            id: isActive
              ? 'materialGroups.toasts.activated'
              : 'materialGroups.toasts.deactivated',
          }),
        );
      } catch (error) {
        toast.error(getApiErrorMessage(error));
      } finally {
        setPendingAvailabilityIds((current) => {
          const next = new Set(current);
          next.delete(group.id);
          return next;
        });
      }
    },
    pendingAvailabilityIds,
  });
  const table = useReactTable({
    data: filteredGroups,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { columnPinning: MATERIAL_GROUP_COLUMN_PINNING },
  });

  const handleCreate = (
    values: Parameters<typeof createMutation.mutate>[0],
  ) => {
    if (!canManage) return;
    if (values.codeMode === 'manual' && !values.code.trim()) {
      createForm.setError('code', {
        type: 'manual',
        message: intl.formatMessage({
          id: 'materialGroups.errors.codeRequired',
        }),
      });
      return;
    }
    createMutation.mutate(values, {
      onSuccess: () => {
        toast.success(
          intl.formatMessage({ id: 'materialGroups.toasts.created' }),
        );
        setCreateOpen(false);
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });
  };

  const handleUpdate = (
    values: Parameters<typeof updateMutation.mutate>[0]['values'],
  ) => {
    if (!canManage || !editingGroup) return;
    updateMutation.mutate(
      { id: editingGroup.id, values },
      {
        onSuccess: () => {
          toast.success(
            intl.formatMessage({ id: 'materialGroups.toasts.updated' }),
          );
          setEditOpen(false);
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  const handleDelete = () => {
    if (!canManage || !deletingGroup) return;
    deleteMutation.mutate(deletingGroup.id, {
      onSuccess: () => {
        toast.success(
          intl.formatMessage(
            { id: 'materialGroups.toasts.deleted' },
            { name: deletingGroup.name },
          ),
        );
        setDeletingGroup(null);
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'materialGroups.page.header' })}
        icon={PackageOpen}
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
            >
              <Plus />
              {intl.formatMessage({ id: 'materialGroups.actions.create' })}
            </Button>
          ) : null
        }
      />

      <DataGrid
        table={table}
        recordCount={filteredGroups.length}
        isLoading={isPermissionsPending || (canView && query.isPending)}
        isFetching={query.isFetching}
        emptyMessage={
          keyword
            ? intl.formatMessage({ id: 'materialGroups.empty.search' })
            : intl.formatMessage({ id: 'materialGroups.empty.list' })
        }
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            stats={
              <MaterialGroupFilterBar
                className="w-64 shrink-0"
                keyword={keyword}
                onKeywordChange={(value) => {
                  setKeyword(value);
                  table.setPageIndex(0);
                }}
              />
            }
            toolbar={
              <div className="ms-auto flex shrink-0 items-center gap-0">
                <Button
                  type="button"
                  variant="ghost"
                  mode="icon"
                  aria-label={intl.formatMessage({
                    id: 'common.actions.refresh',
                  })}
                  title={intl.formatMessage({ id: 'common.actions.refresh' })}
                  onClick={() => void query.refetch()}
                >
                  <RefreshCw />
                </Button>
                <DataGridColumnVisibility
                  table={table}
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      mode="icon"
                      aria-label="Hiển thị cột"
                      title="Hiển thị cột"
                    >
                      <Columns3Cog />
                    </Button>
                  }
                />
              </div>
            }
          />

          <CardTable className="min-h-0 flex-1">
            {!isPermissionsPending && !canView ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'materialGroups.errors.authorizationTitle',
                })}
                description={intl.formatMessage({
                  id: 'materialGroups.errors.authorization',
                })}
              />
            ) : query.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'materialGroups.errors.loadTitle',
                })}
                description={
                  isAuthorizationError(query.error)
                    ? intl.formatMessage({
                        id: 'materialGroups.errors.authorization',
                      })
                    : getApiErrorMessage(query.error)
                }
                onRetry={() => void query.refetch()}
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

      <MaterialGroupFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        form={createForm}
        onSubmit={handleCreate}
        isSaving={createMutation.isPending}
        title={intl.formatMessage({ id: 'materialGroups.dialogs.createTitle' })}
        codePattern={codePattern}
        resetKey="create"
      />
      <MaterialGroupFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        form={editForm}
        onSubmit={handleUpdate}
        isSaving={updateMutation.isPending}
        title={intl.formatMessage({ id: 'materialGroups.dialogs.editTitle' })}
        codePattern={codePattern}
        resetKey={editingGroup?.id ?? 'edit'}
      />
      <ConfirmDialog
        open={deletingGroup !== null}
        onOpenChange={(open) => !open && setDeletingGroup(null)}
        title={intl.formatMessage({ id: 'materialGroups.dialogs.deleteTitle' })}
        description={intl.formatMessage(
          { id: 'materialGroups.dialogs.deleteDescription' },
          { name: deletingGroup?.name ?? '' },
        )}
        confirmLabel={intl.formatMessage({
          id: 'materialGroups.dialogs.deleteConfirm',
        })}
        confirmVariant="destructive"
        isConfirming={deleteMutation.isPending}
        closeOnConfirm={false}
        onConfirm={handleDelete}
      />
    </div>
  );
}
