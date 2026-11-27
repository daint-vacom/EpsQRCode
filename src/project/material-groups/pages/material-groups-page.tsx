import { useMemo, useState } from 'react';
import { useCodeGenerationPatternsQuery } from '@/project/code-generation/hooks/use-code-generation-patterns';
import { DEFAULT_CODE_GENERATION_PATTERNS } from '@/project/code-generation/model/code-pattern-example';
import { useMaterialGroupMaterialCountsQuery } from '@/project/materials/hooks/use-materials';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import { Plus } from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { PROJECT_FEATURE_ICONS } from '@/config/project-feature-icons';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardToolbar,
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import type { SelectOption } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { MaterialGroupTreePanel } from '../components/material-group-tree.generated';
import {
  mapMaterialGroupToFormValues,
  MaterialGroupFormDialog,
  useMaterialGroupForm,
} from '../forms/material-group-form.generated';
import {
  useCreateMaterialGroupMutation,
  useDeleteMaterialGroupMutation,
  useMaterialGroupsQuery,
  useMoveMaterialGroupMutation,
  useUpdateMaterialGroupMutation,
} from '../hooks/use-material-groups';
import {
  ROOT_MATERIAL_GROUP_PARENT,
  type MaterialGroup,
} from '../model/material-group';
import { MATERIAL_GROUP_PERMISSION_CODES } from '../model/material-group-permissions';
import {
  buildMaterialGroupTree,
  getMaterialGroupDescendantIds,
  getMaterialGroupPath,
} from '../model/material-group-tree';
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
  const canView = true;
  const canManage = hasPermission(MATERIAL_GROUP_PERMISSION_CODES.manage);
  const canViewMaterials =
    hasPermission(MATERIAL_PERMISSION_CODES.view) ||
    hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const codePatternsQuery = useCodeGenerationPatternsQuery(
    !isPermissionsPending && canManage,
  );
  const codePattern =
    codePatternsQuery.data?.find((item) => item.entityKey === 'material_group')
      ?.pattern ?? DEFAULT_CODE_GENERATION_PATTERNS.material_group;
  const query = useMaterialGroupsQuery(isPermissionsPending || canView);
  const materialCountsQuery = useMaterialGroupMaterialCountsQuery(
    !isPermissionsPending && canViewMaterials,
  );
  const createMutation = useCreateMaterialGroupMutation();
  const updateMutation = useUpdateMaterialGroupMutation();
  const moveMutation = useMoveMaterialGroupMutation();
  const deleteMutation = useDeleteMaterialGroupMutation();
  const [keyword, setKeyword] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MaterialGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<MaterialGroup | null>(
    null,
  );
  const createForm = useMaterialGroupForm();
  const editForm = useMaterialGroupForm();

  const groups = query.data ?? EMPTY_MATERIAL_GROUPS;
  const filteredGroups = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi');
    return groups.filter(
      (group) =>
        !normalizedKeyword ||
        [group.code, group.name, group.description].some((value) =>
          value.toLocaleLowerCase('vi').includes(normalizedKeyword),
        ),
    );
  }, [groups, keyword]);

  const displayedGroups = useMemo(() => {
    const includedIds = new Set(filteredGroups.map((group) => group.id));
    const groupsById = new Map(groups.map((group) => [group.id, group]));
    for (const group of filteredGroups) {
      let parentId = group.parentId;
      while (parentId && !includedIds.has(parentId)) {
        includedIds.add(parentId);
        parentId = groupsById.get(parentId)?.parentId ?? null;
      }
    }
    return groups.filter((group) => includedIds.has(group.id));
  }, [filteredGroups, groups]);
  const treeNodes = useMemo(
    () => buildMaterialGroupTree(displayedGroups),
    [displayedGroups],
  );
  const countByNode = useMemo(
    () => new Map(Object.entries(materialCountsQuery.data?.counts ?? {})),
    [materialCountsQuery.data?.counts],
  );
  const parentOptionsFor = (
    excludeGroupId?: string,
  ): SelectOption<MaterialGroup>[] => {
    const excludedIds = excludeGroupId
      ? getMaterialGroupDescendantIds(groups, excludeGroupId)
      : new Set<string>();
    return [
      {
        value: ROOT_MATERIAL_GROUP_PARENT,
        label: intl.formatMessage({ id: 'materialGroups.fields.root' }),
      },
      ...groups
        .filter((group) => !excludedIds.has(group.id))
        .map((group) => ({
          value: group.id,
          label: getMaterialGroupPath(groups, group.id),
          data: group,
        })),
    ];
  };
  const createParentIdOptions = parentOptionsFor();
  const editParentIdOptions = parentOptionsFor(editingGroup?.id);

  const canMoveGroup = (groupId: string, parentId: string | null) => {
    const group = groups.find((item) => item.id === groupId);
    if (!group || group.id === parentId || group.parentId === parentId) {
      return false;
    }
    if (parentId === null) return true;
    return !getMaterialGroupDescendantIds(groups, groupId).has(parentId);
  };

  const moveGroup = (groupId: string, parentId: string | null) => {
    if (
      !canManage ||
      moveMutation.isPending ||
      !canMoveGroup(groupId, parentId)
    ) {
      return;
    }
    moveMutation.mutate(
      { id: groupId, parentId },
      {
        onSuccess: () =>
          toast.success(
            intl.formatMessage({ id: 'materialGroups.toasts.moved' }),
          ),
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  const openEdit = (group: MaterialGroup) => {
    if (!canManage) return;
    setEditingGroup(group);
    editForm.reset(mapMaterialGroupToFormValues(group));
    setEditOpen(true);
  };

  const openCreate = (parentId: string | null = null) => {
    if (!canManage) return;
    createForm.setValue('parentId', parentId ?? ROOT_MATERIAL_GROUP_PARENT, {
      shouldDirty: false,
    });
    setCreateOpen(true);
  };

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
        if (selectedGroupId === deletingGroup.id) setSelectedGroupId(null);
        setDeletingGroup(null);
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'materialGroups.page.header' })}
        icon={PROJECT_FEATURE_ICONS.materialGroups}
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => openCreate()}
            >
              <Plus />
              {intl.formatMessage({ id: 'materialGroups.actions.create' })}
            </Button>
          ) : null
        }
      />
      <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
        <CardHeader className="shrink-0 border-b">
          <CardToolbar className="w-full flex-wrap justify-between gap-3">
            <span className="text-sm text-foreground">
              {intl.formatMessage(
                { id: 'materialGroups.tree.count' },
                { count: filteredGroups.length },
              )}
            </span>
            <MaterialGroupFilterBar
              className="w-64 shrink-0"
              keyword={keyword}
              onKeywordChange={setKeyword}
              disabled={!canView || isPermissionsPending}
            />
          </CardToolbar>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
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
          ) : isPermissionsPending || query.isPending ? (
            <div
              className="flex flex-1 flex-col gap-3 p-5"
              aria-label={intl.formatMessage({ id: 'common.state.loading' })}
            >
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton
                  key={index}
                  className="h-9 w-full"
                  style={{ marginInlineStart: `${(index % 3) * 16}px` }}
                />
              ))}
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-secondary-foreground">
              {intl.formatMessage({
                id: keyword
                  ? 'materialGroups.empty.search'
                  : 'materialGroups.empty.list',
              })}
            </div>
          ) : (
            <MaterialGroupTreePanel
              className="h-full"
              nodes={treeNodes}
              selectedId={selectedGroupId}
              countByNode={countByNode}
              allCount={materialCountsQuery.data?.total ?? 0}
              isAllSelected={selectedGroupId === null}
              onSelectAll={() => setSelectedGroupId(null)}
              onSelect={setSelectedGroupId}
              onAdd={canManage ? openCreate : undefined}
              onEdit={canManage ? openEdit : undefined}
              onDelete={
                canManage
                  ? (group) => {
                      if (groups.some((item) => item.parentId === group.id)) {
                        toast.error(
                          intl.formatMessage({
                            id: 'materialGroups.errors.hasChildren',
                          }),
                        );
                        return;
                      }
                      setDeletingGroup(group);
                    }
                  : undefined
              }
              onMove={canManage ? moveGroup : undefined}
              canMove={canMoveGroup}
              isMovePending={moveMutation.isPending}
            />
          )}
        </CardContent>
      </Card>

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
        parentIdOptions={createParentIdOptions}
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
        inspectionScopeId={editingGroup?.id}
        parentIdOptions={editParentIdOptions}
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
