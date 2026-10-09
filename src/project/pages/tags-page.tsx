import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  FolderPlus,
  Pencil,
  Plus,
  Tags,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTable,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  createTag,
  createTagGroup,
  deleteTag,
  deleteTagGroup,
  loadTagWorkspace,
  updateTag,
  updateTagGroup,
} from '../tags/api/tags.api';
import { TagGroupIcon } from '../tags/components/tag-group-icon';
import { TagFormDialog, useTagForm } from '../tags/forms/tag-form.generated';
import {
  TagGroupFormDialog,
  useTagGroupForm,
} from '../tags/forms/tag-group-form.generated';
import {
  emptyTagGroupForm,
  type Tag,
  type TagFormValues,
  type TagGroup,
  type TagGroupFormValues,
} from '../tags/model/tag';
import { sortTagGroups } from '../tags/model/tag-group-order';
import { useTagColumns } from '../tags/table/tag.columns.generated';

const EMPTY_GROUPS: TagGroup[] = [];
const EMPTY_TAGS: Tag[] = [];

type PendingDelete = {
  kind: 'group' | 'tag';
  id: string;
  name: string;
};

export function TagsPage() {
  const intl = useIntl();
  const { userId, hasPermission } = useUser();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const workspaceQuery = useQuery({
    queryKey: ['project', 'tags', userId, tenantId],
    queryFn: () => {
      if (!userId || !tenantId) {
        throw new Error(
          intl.formatMessage({ id: 'common.errors.dataNotReady' }),
        );
      }
      return loadTagWorkspace(userId, tenantId);
    },
    enabled: Boolean(userId && tenantId),
  });
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [tagCreateDialogOpen, setTagCreateDialogOpen] = useState(false);
  const [tagEditDialogOpen, setTagEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TagGroup | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const workspace = workspaceQuery.data;
  const groups = workspace?.groups ?? EMPTY_GROUPS;
  const orderedGroups = useMemo(() => sortTagGroups(groups), [groups]);
  const tags = workspace?.tags ?? EMPTY_TAGS;
  const queryGroupCode = searchParams.get('group');
  const queryGroupId = orderedGroups.find(
    (group) => group.code === queryGroupCode,
  )?.id;
  const activeGroupId = orderedGroups.some(
    (group) => group.id === selectedGroupId,
  )
    ? selectedGroupId
    : (queryGroupId ?? orderedGroups[0]?.id ?? null);
  const selectedGroup = orderedGroups.find(
    (group) => group.id === activeGroupId,
  );
  const canCreateTag = hasPermission('system:tag:create');
  const tagGroups = orderedGroups.filter((group) => group.kind === 'tag');
  const tagGroupOptions = tagGroups;
  const tableRows = useMemo(
    () => tags.filter((tag) => tag.groupId === activeGroupId),
    [activeGroupId, tags],
  );

  const invalidateWorkspace = () =>
    queryClient.invalidateQueries({ queryKey: ['project', 'tags', userId] });

  const groupForm = useTagGroupForm();
  const tagCreateForm = useTagForm();
  const tagEditForm = useTagForm();

  const groupMutation = useMutation({
    mutationFn: async (values: TagGroupFormValues) => {
      if (!workspace || !userId)
        throw new Error(
          intl.formatMessage({ id: 'common.errors.dataNotReady' }),
        );
      if (editingGroup) {
        return updateTagGroup(editingGroup.id, values);
      }
      return createTagGroup(workspace.tenantId, userId, values);
    },
    onSuccess: async () => {
      toast.success(
        intl.formatMessage({
          id: editingGroup
            ? 'tags.feedback.groupUpdated'
            : 'tags.feedback.groupCreated',
        }),
      );
      setGroupDialogOpen(false);
      await invalidateWorkspace();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const tagMutation = useMutation({
    mutationFn: async ({
      values,
      tag,
    }: {
      values: TagFormValues;
      tag: Tag | null;
    }) => {
      if (!workspace || !userId)
        throw new Error(
          intl.formatMessage({ id: 'common.errors.dataNotReady' }),
        );
      if (tag) return updateTag(tag.id, values);
      return createTag(workspace.tenantId, userId, values);
    },
    onSuccess: async (_, variables) => {
      toast.success(
        intl.formatMessage({
          id: variables.tag
            ? 'tags.feedback.itemUpdated'
            : 'tags.feedback.itemCreated',
        }),
      );
      if (variables.tag) {
        setTagEditDialogOpen(false);
      } else {
        setTagCreateDialogOpen(false);
      }
      await invalidateWorkspace();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: deleteTagGroup,
    onSuccess: async () => {
      toast.success(intl.formatMessage({ id: 'tags.feedback.groupDeleted' }));
      await invalidateWorkspace();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteTagMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: async () => {
      toast.success(intl.formatMessage({ id: 'tags.feedback.itemDeleted' }));
      await invalidateWorkspace();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns = useTagColumns({
    onAddTag: (row) => openCreateTag(row.groupId),
    onEdit: openEditTag,
    onDelete: (row) => {
      setPendingDelete({ kind: 'tag', id: row.id, name: row.name });
    },
    onToggleGroup: () => undefined,
    canUpdateTag: hasPermission('system:tag:update'),
    canDeleteTag: hasPermission('system:tag:delete'),
  });
  const table = useReactTable({
    data: tableRows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  if (workspaceQuery.isError) {
    return (
      <div className="p-4 lg:p-5">
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <TriangleAlert className="size-8 text-destructive" />
          <div>
            <CardTitle>
              {intl.formatMessage({ id: 'tags.page.loadError' })}
            </CardTitle>
            <CardDescription className="mt-1">
              {getApiErrorMessage(workspaceQuery.error)}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => workspaceQuery.refetch()}>
            {intl.formatMessage({ id: 'tags.page.retry' })}
          </Button>
        </Card>
      </div>
    );
  }

  function openCreateGroup() {
    setEditingGroup(null);
    groupForm.reset(emptyTagGroupForm);
    setGroupDialogOpen(true);
  }

  function openEditGroup(group: TagGroup) {
    if (group.isSystem) {
      toast.error(
        intl.formatMessage({ id: 'tags.errors.systemGroupReadOnly' }),
      );
      return;
    }
    setEditingGroup(group);
    groupForm.reset({
      name: group.name,
      code: group.code,
      description: group.description,
    });
    setGroupDialogOpen(true);
  }

  function openCreateTag(groupId = activeGroupId ?? undefined) {
    if (groupId) {
      tagCreateForm.setValue('groupId', groupId);
    }
    setTagCreateDialogOpen(true);
  }

  function openEditTag(tag: Tag) {
    setEditingTag(tag);
    tagEditForm.reset({
      groupId: tag.groupId,
      name: tag.name,
      description: tag.description,
      code: tag.code,
      color: tag.color ?? '#2563eb',
    });
    setTagEditDialogOpen(true);
  }

  function requestDeleteGroup(group: TagGroup) {
    if (group.isSystem) {
      toast.error(
        intl.formatMessage({ id: 'tags.errors.systemGroupReadOnly' }),
      );
      return;
    }
    if (group.tagCount > 0) {
      toast.error(intl.formatMessage({ id: 'tags.errors.groupMustBeEmpty' }));
      return;
    }
    setPendingDelete({ kind: 'group', id: group.id, name: group.name });
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:overflow-hidden xl:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'tags.page.title' })}
        icon={Tags}
        className="shrink-0"
      />
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-admin-page-section xl:flex-row xl:overflow-hidden">
        <Card className="max-h-[220px] w-full shrink-0 overflow-hidden xl:max-h-none xl:w-[260px]">
          <CardHeader className="min-h-0 flex-col items-start gap-1 p-4">
            <div className="flex w-full items-center justify-between gap-2">
              <CardTitle className="text-[15px]">
                {intl.formatMessage({ id: 'tags.groups.title' })}
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    mode="icon"
                    size="sm"
                    aria-label={intl.formatMessage({ id: 'tags.groups.add' })}
                    onClick={openCreateGroup}
                  >
                    <FolderPlus className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {intl.formatMessage({ id: 'tags.groups.add' })}
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto p-3 sm:grid-cols-3 xl:flex xl:flex-col">
            {orderedGroups.length === 0 ? (
              <div className="flex min-h-20 items-center justify-center rounded-md border border-dashed px-3 text-center text-sm text-muted-foreground sm:col-span-3 xl:min-h-24">
                {intl.formatMessage({ id: 'tags.groups.empty' })}
              </div>
            ) : (
              orderedGroups.map((group) => {
                const isSelected = group.id === activeGroupId;

                return (
                  <button
                    key={group.id}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/8 text-foreground'
                        : 'border-border bg-background hover:bg-field'
                    }`}
                    onClick={() => {
                      setSelectedGroupId(group.id);
                      setSearchParams({ group: group.code });
                    }}
                  >
                    <TagGroupIcon
                      groupCode={group.code}
                      moduleCode={group.moduleCode}
                      isSystem={group.isSystem}
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                      {group.name}
                    </span>
                    <Badge
                      size="sm"
                      shape="circle"
                      variant={isSelected ? 'primary' : 'secondary'}
                      appearance={isSelected ? 'default' : 'light'}
                      className="ms-auto shrink-0"
                    >
                      {group.tagCount}
                    </Badge>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <DataGrid
          table={table}
          recordCount={tableRows.length}
          isLoading={workspaceQuery.isLoading}
          isFetching={workspaceQuery.isFetching}
          emptyMessage={
            selectedGroup
              ? intl.formatMessage(
                  { id: 'tags.groups.emptyItems' },
                  { group: selectedGroup.name },
                )
              : intl.formatMessage({ id: 'tags.groups.empty' })
          }
        >
          <Card className="min-h-0 w-full min-w-0 flex-1 overflow-hidden">
            <CardHeader className="justify-between">
              <CardTitle>
                {intl.formatMessage(
                  {
                    id: selectedGroup
                      ? 'tags.items.listTitleForGroup'
                      : 'tags.items.listTitle',
                  },
                  selectedGroup ? { group: selectedGroup.name } : undefined,
                )}
              </CardTitle>
              <CardToolbar>
                <ShortcutTooltip
                  label={intl.formatMessage({ id: 'tags.items.add' })}
                  shortcut="Alt + N"
                >
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!activeGroupId || !canCreateTag}
                    onClick={() => openCreateTag()}
                    data-shortcut-action="create"
                  >
                    <Plus className="size-4" />
                    {intl.formatMessage({ id: 'tags.items.add' })}
                  </Button>
                </ShortcutTooltip>
                {selectedGroup && !selectedGroup.isSystem ? (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openEditGroup(selectedGroup)}
                        >
                          <Pencil className="size-4" />
                          {intl.formatMessage({ id: 'common.actions.edit' })}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {intl.formatMessage({ id: 'tags.groups.edit' })}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          mode="icon"
                          aria-label={intl.formatMessage({
                            id: 'tags.groups.delete',
                          })}
                          onClick={() => requestDeleteGroup(selectedGroup)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {intl.formatMessage({ id: 'tags.groups.delete' })}
                      </TooltipContent>
                    </Tooltip>
                  </>
                ) : null}
              </CardToolbar>
            </CardHeader>
            <CardTable className="min-h-0 flex-1">
              <ScrollArea className="h-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardTable>
          </Card>
        </DataGrid>
      </div>

      <TagGroupFormDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        form={groupForm}
        onSubmit={(values) => groupMutation.mutate(values)}
        isSaving={groupMutation.isPending}
        title={intl.formatMessage({
          id: editingGroup
            ? 'tags.dialogs.groupEditTitle'
            : 'tags.dialogs.groupCreateTitle',
        })}
      />
      <TagFormDialog
        open={tagCreateDialogOpen}
        onOpenChange={setTagCreateDialogOpen}
        mode="create"
        form={tagCreateForm}
        onSubmit={(values) => tagMutation.mutate({ values, tag: null })}
        isSaving={tagMutation.isPending}
        title={intl.formatMessage({ id: 'tags.dialogs.itemCreateTitle' })}
        groupIdOptions={tagGroupOptions.map((group) => ({
          value: group.id,
          label: group.name,
        }))}
      />
      <TagFormDialog
        open={tagEditDialogOpen}
        onOpenChange={setTagEditDialogOpen}
        mode="edit"
        form={tagEditForm}
        onSubmit={(values) => {
          if (editingTag) {
            tagMutation.mutate({ values, tag: editingTag });
          }
        }}
        isSaving={tagMutation.isPending}
        title={intl.formatMessage({ id: 'tags.dialogs.itemEditTitle' })}
        groupIdOptions={tagGroupOptions.map((group) => ({
          value: group.id,
          label: group.name,
        }))}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete?.kind === 'group'
            ? intl.formatMessage({ id: 'tags.dialogs.deleteGroupTitle' })
            : intl.formatMessage({ id: 'tags.dialogs.deleteItemTitle' })
        }
        description={
          pendingDelete
            ? intl.formatMessage(
                {
                  id:
                    pendingDelete.kind === 'group'
                      ? 'tags.dialogs.deleteGroupDescription'
                      : 'tags.dialogs.deleteItemDescription',
                },
                { name: pendingDelete.name },
              )
            : ''
        }
        confirmLabel={intl.formatMessage({
          id:
            pendingDelete?.kind === 'group'
              ? 'tags.dialogs.deleteGroupConfirm'
              : 'tags.dialogs.deleteItemConfirm',
        })}
        confirmVariant="destructive"
        onConfirm={() => {
          if (!pendingDelete) return;
          if (pendingDelete.kind === 'group') {
            deleteGroupMutation.mutate(pendingDelete.id);
          } else {
            deleteTagMutation.mutate(pendingDelete.id);
          }
        }}
      />
    </div>
  );
}
