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
  const { userId } = useUser();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const workspaceQuery = useQuery({
    queryKey: ['project', 'tags', userId, tenantId],
    queryFn: () => {
      if (!userId || !tenantId) {
        throw new Error('Chưa xác định tổ chức hiện tại.');
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

  const workspace = workspaceQuery.data;
  const groups = workspace?.groups ?? EMPTY_GROUPS;
  const orderedGroups = useMemo(() => sortTagGroups(groups), [groups]);
  const tags = workspace?.tags ?? EMPTY_TAGS;
  const activeGroupId = orderedGroups.some(
    (group) => group.id === selectedGroupId,
  )
    ? selectedGroupId
    : (orderedGroups[0]?.id ?? null);
  const selectedGroup = orderedGroups.find(
    (group) => group.id === activeGroupId,
  );
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
      if (!workspace || !userId) throw new Error('Chưa xác định tenant.');
      if (editingGroup) {
        return updateTagGroup(editingGroup.id, values);
      }
      return createTagGroup(workspace.tenantId, userId, values);
    },
    onSuccess: async () => {
      toast.success(
        editingGroup ? 'Đã cập nhật nhóm nhãn.' : 'Đã tạo nhóm nhãn.',
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
      if (!workspace || !userId) throw new Error('Chưa xác định tenant.');
      if (tag) return updateTag(tag.id, values);
      return createTag(workspace.tenantId, userId, values);
    },
    onSuccess: async (_, variables) => {
      toast.success(variables.tag ? 'Đã cập nhật nhãn.' : 'Đã tạo nhãn.');
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
      toast.success('Đã xóa nhóm nhãn.');
      await invalidateWorkspace();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteTagMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: async () => {
      toast.success('Đã xóa nhãn.');
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
            <CardTitle>Không tải được hệ thống nhãn</CardTitle>
            <CardDescription className="mt-1">
              {getApiErrorMessage(workspaceQuery.error)}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => workspaceQuery.refetch()}>
            Thử lại
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
      toast.error('Không thể sửa hoặc xóa nhóm nhãn hệ thống.');
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
      toast.error('Không thể sửa hoặc xóa nhóm nhãn hệ thống.');
      return;
    }
    if (group.tagCount > 0) {
      toast.error('Hãy xóa các nhãn trong nhóm trước khi xóa nhóm.');
      return;
    }
    setPendingDelete({ kind: 'group', id: group.id, name: group.name });
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:overflow-hidden xl:p-5">
      <PageHeader title="Quản lý nhãn" icon={Tags} className="shrink-0" />
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-admin-page-section xl:flex-row xl:overflow-hidden">
        <Card className="max-h-[220px] w-full shrink-0 overflow-hidden xl:max-h-none xl:w-[260px]">
          <CardHeader className="min-h-0 flex-col items-start gap-1 p-4">
            <div className="flex w-full items-center justify-between gap-2">
              <CardTitle className="text-[15px]">Nhóm nhãn</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    mode="icon"
                    size="sm"
                    aria-label="Thêm nhóm nhãn"
                    onClick={openCreateGroup}
                  >
                    <FolderPlus className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Thêm nhóm nhãn</TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto p-3 sm:grid-cols-3 xl:flex xl:flex-col">
            {orderedGroups.length === 0 ? (
              <div className="flex min-h-20 items-center justify-center rounded-md border border-dashed px-3 text-center text-sm text-muted-foreground sm:col-span-3 xl:min-h-24">
                Chưa có nhóm nhãn
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
                    onClick={() => setSelectedGroupId(group.id)}
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
              ? `Nhóm "${selectedGroup.name}" chưa có nhãn`
              : 'Chưa có nhóm nhãn'
          }
        >
          <Card className="min-h-0 w-full min-w-0 flex-1 overflow-hidden">
            <CardHeader className="justify-between">
              <CardTitle>
                Danh sách nhãn
                {selectedGroup ? (
                  <span className="font-semibold text-primary">
                    : {selectedGroup.name}
                  </span>
                ) : null}
              </CardTitle>
              <CardToolbar>
                <ShortcutTooltip label="Thêm nhãn" shortcut="Alt + N">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!activeGroupId}
                    onClick={openCreateTag}
                    data-shortcut-action="create"
                  >
                    <Plus className="size-4" />
                    Thêm nhãn
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
                          Chỉnh sửa
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Chỉnh sửa nhóm nhãn</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          mode="icon"
                          aria-label="Xóa nhóm nhãn"
                          onClick={() => requestDeleteGroup(selectedGroup)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Xóa nhóm nhãn</TooltipContent>
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
        title={editingGroup ? 'Sửa nhóm nhãn' : 'Thêm nhóm nhãn'}
      />
      <TagFormDialog
        open={tagCreateDialogOpen}
        onOpenChange={setTagCreateDialogOpen}
        mode="create"
        form={tagCreateForm}
        onSubmit={(values) => tagMutation.mutate({ values, tag: null })}
        isSaving={tagMutation.isPending}
        title="Thêm nhãn"
        groupIdOptions={orderedGroups.map((group) => ({
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
        title="Sửa nhãn"
        groupIdOptions={orderedGroups.map((group) => ({
          value: group.id,
          label: group.name,
        }))}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={pendingDelete?.kind === 'group' ? 'Xóa nhóm nhãn?' : 'Xóa nhãn?'}
        description={
          pendingDelete
            ? `Bạn có chắc muốn xóa ${
                pendingDelete.kind === 'group' ? 'nhóm nhãn' : 'nhãn'
              } "${pendingDelete.name}"?`
            : ''
        }
        confirmLabel={
          pendingDelete?.kind === 'group' ? 'Xóa nhóm nhãn' : 'Xóa nhãn'
        }
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
