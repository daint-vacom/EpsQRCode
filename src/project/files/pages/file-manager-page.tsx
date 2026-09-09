import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileWarning,
  FolderOpen,
  FolderPlus,
  HardDrive,
  MoreVertical,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileIcon } from '@/components/ui/files/file-icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  createCustomFileFolder,
  deleteFileManagerItem,
  getTenantStorageQuota,
  listFileFolders,
  listFileManagerItems,
  renameFileManagerItem,
  uploadFilesToFolder,
} from '../api/file-manager.api';
import { FileRenameDialogShell } from '../components/file-rename-dialog-shell.generated';
import {
  fileFolderCreateDefaultValues,
  FileFolderCreateFormDialog,
  useFileFolderCreateForm,
} from '../forms/file-folder-create-form.generated';
import {
  formatFileSize,
  type FileFolder,
  type FileFolderCreateFormValues,
  type FileManagerItem,
} from '../model/file-manager';

function formatQuota(used: number, limit: number) {
  return `${formatFileSize(used)} / ${formatFileSize(limit)}`;
}

function StorageQuotaBadge({
  usedBytes,
  limitBytes,
  percent,
}: {
  usedBytes: number;
  limitBytes: number;
  percent: number;
}) {
  return (
    <div className="inline-flex min-w-0 items-center gap-2 rounded-admin-control border border-border bg-muted/30 px-3 py-1.5 text-xs">
      <HardDrive className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="shrink-0 font-medium">
        {formatQuota(usedBytes, limitBytes)}
      </span>
      <Progress value={percent} className="w-16" />
    </div>
  );
}

function FileManagerItemMenu({
  item,
  onRename,
  onDelete,
}: {
  item: FileManagerItem;
  onRename: (item: FileManagerItem) => void;
  onDelete: (item: FileManagerItem) => void;
}) {
  const canEdit = item.kind === 'file' || item.folderType === 'custom';

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="sm"
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`Thao tác với ${item.name}`}
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent variant="light">Tùy chọn</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem disabled={!canEdit} onSelect={() => onRename(item)}>
          <Pencil />
          Đổi tên
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={!canEdit}
          onSelect={() => onDelete(item)}
        >
          <Trash2 />
          Xóa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FileManagerTile({
  item,
  onOpen,
  onRename,
  onDelete,
}: {
  item: FileManagerItem;
  onOpen: (item: FileManagerItem) => void;
  onRename: (item: FileManagerItem) => void;
  onDelete: (item: FileManagerItem) => void;
}) {
  const isFolder = item.kind === 'folder';

  return (
    <article
      className={cn(
        'group min-w-0 rounded-xl border border-border bg-muted/35 p-2 shadow-xs transition-all',
        'hover:border-primary/35 hover:shadow-md',
        isFolder ? 'self-start' : 'min-h-56',
      )}
    >
      <div className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-start focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          onDoubleClick={() => onOpen(item)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpen(item);
            }
          }}
        >
          {isFolder ? (
            <FolderOpen className="size-4 shrink-0 text-admin-blue-dark" />
          ) : (
            <FileIcon
              fileType={item.mimeType}
              fileName={item.name}
              alt=""
              className="size-4 shrink-0"
            />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {item.name}
              </span>
            </TooltipTrigger>
            <TooltipContent variant="light" className="max-w-sm break-all">
              {item.name}
            </TooltipContent>
          </Tooltip>
        </button>
        <FileManagerItemMenu
          item={item}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>

      {!isFolder ? (
        <>
          <button
            type="button"
            className="mt-1 flex aspect-[1.55] w-full items-center justify-center rounded-lg bg-background p-5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            onDoubleClick={() => onOpen(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpen(item);
              }
            }}
            aria-label={`Mở tệp ${item.name}`}
          >
            <FileIcon
              fileType={item.mimeType}
              fileName={item.name}
              alt=""
              className="size-16"
            />
          </button>
          <div className="flex items-center justify-between gap-2 px-1 pt-2 text-[11px] text-muted-foreground">
            <span className="truncate">{item.sizeLabel}</span>
            <span className="shrink-0">{item.modifiedAtLabel}</span>
          </div>
        </>
      ) : null}
    </article>
  );
}

function FolderPath({
  folders,
  selectedFolderId,
  tenantName,
  onSelect,
}: {
  folders: FileFolder[];
  selectedFolderId: string | null;
  tenantName: string | null;
  onSelect: (folderId: string | null) => void;
}) {
  const folderById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  );
  const path = useMemo(() => {
    const result: FileFolder[] = [];
    const visited = new Set<string>();
    let folder = selectedFolderId
      ? folderById.get(selectedFolderId)
      : undefined;

    while (folder && !visited.has(folder.id)) {
      result.unshift(folder);
      visited.add(folder.id);
      folder = folder.parentId ? folderById.get(folder.parentId) : undefined;
    }

    return result;
  }, [folderById, selectedFolderId]);

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap overflow-x-auto whitespace-nowrap text-xs sm:text-sm">
        <BreadcrumbItem>
          {path.length === 0 ? (
            <BreadcrumbPage className="font-semibold">
              {tenantName ?? 'Tenant'}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onSelect(null);
              }}
            >
              {tenantName ?? 'Tenant'}
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {path.map((folder, index) => {
          const isCurrent = index === path.length - 1;
          return (
            <span key={folder.id} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isCurrent ? (
                  <BreadcrumbPage className="font-semibold">
                    {folder.displayName}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      onSelect(folder.id);
                    }}
                  >
                    {folder.displayName}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function FileManagerPage() {
  const { tenantId, tenantName } = useTenant();
  const { userId } = useUser();
  const queryClient = useQueryClient();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(
    null,
  );
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [editingItem, setEditingItem] = useState<FileManagerItem | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingItem, setDeletingItem] = useState<FileManagerItem | null>(
    null,
  );
  const folderForm = useFileFolderCreateForm();

  const foldersQuery = useQuery({
    queryKey: ['project', 'file-manager', 'folders', tenantId],
    queryFn: () => listFileFolders(tenantId!),
    enabled: Boolean(tenantId),
  });
  const itemsQuery = useQuery({
    queryKey: ['project', 'file-manager', 'items', tenantId, selectedFolderId],
    queryFn: () => listFileManagerItems(tenantId!, selectedFolderId),
    enabled: Boolean(tenantId),
  });
  const quotaQuery = useQuery({
    queryKey: ['project', 'file-manager', 'quota', tenantId],
    queryFn: () => getTenantStorageQuota(tenantId!),
    enabled: Boolean(tenantId),
  });

  const customRootId = useMemo(
    () =>
      foldersQuery.data?.find((folder) => folder.systemKey === 'custom')?.id ??
      null,
    [foldersQuery.data],
  );
  const beginCreateFolder = useCallback(
    (parentId: string | null) => {
      setNewFolderParentId(parentId ?? customRootId);
      setIsCreatingFolder(true);
    },
    [customRootId],
  );

  useEffect(() => {
    if (isCreatingFolder) folderForm.reset(fileFolderCreateDefaultValues);
  }, [folderForm, isCreatingFolder]);

  const visibleItems = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase('vi');
    if (!normalized) return itemsQuery.data ?? [];
    return (itemsQuery.data ?? []).filter((item) =>
      item.name.toLocaleLowerCase('vi').includes(normalized),
    );
  }, [itemsQuery.data, keyword]);
  const visibleFolders = useMemo(
    () => visibleItems.filter((item) => item.kind === 'folder'),
    [visibleItems],
  );
  const visibleFiles = useMemo(
    () => visibleItems.filter((item) => item.kind === 'file'),
    [visibleItems],
  );

  const folderMutation = useMutation({
    mutationFn: (values: FileFolderCreateFormValues) => {
      if (!tenantId || !userId) {
        throw new Error('Chưa xác định tenant hoặc người dùng.');
      }
      return createCustomFileFolder(
        tenantId,
        newFolderParentId ?? customRootId,
        values.name,
        userId,
      );
    },
    onSuccess: () => {
      toast.success('Đã tạo thư mục.');
      folderForm.reset(fileFolderCreateDefaultValues);
      setNewFolderParentId(null);
      setIsCreatingFolder(false);
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'folders', tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'items', tenantId],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => {
      if (!tenantId || !userId || !selectedFolderId) {
        throw new Error('Hãy chọn thư mục trước khi tải tệp lên.');
      }
      return uploadFilesToFolder(tenantId, selectedFolderId, userId, files);
    },
    onSuccess: (_, files) => {
      toast.success(`Đã tải lên ${files.length} tệp.`);
      void queryClient.invalidateQueries({
        queryKey: [
          'project',
          'file-manager',
          'items',
          tenantId,
          selectedFolderId,
        ],
      });
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'quota', tenantId],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const renameMutation = useMutation({
    mutationFn: () => {
      if (!tenantId || !editingItem) {
        throw new Error('Không tìm thấy mục cần đổi tên.');
      }
      return renameFileManagerItem(tenantId, editingItem, editingName);
    },
    onSuccess: () => {
      toast.success('Đã đổi tên mục.');
      setEditingItem(null);
      setEditingName('');
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'folders', tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'items', tenantId],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!tenantId || !deletingItem) {
        throw new Error('Không tìm thấy mục cần xóa.');
      }
      return deleteFileManagerItem(tenantId, deletingItem);
    },
    onSuccess: () => {
      toast.success('Đã xóa mục.');
      setDeletingItem(null);
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'folders', tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'items', tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'quota', tenantId],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const requestRename = useCallback((item: FileManagerItem) => {
    setEditingItem(item);
    setEditingName(item.name);
  }, []);

  const requestDelete = useCallback((item: FileManagerItem) => {
    setDeletingItem(item);
  }, []);

  const onDrop = useCallback(
    (files: File[]) => uploadMutation.mutate(files),
    [uploadMutation],
  );
  const dropzone = useDropzone({
    onDrop,
    multiple: true,
    disabled: !selectedFolderId || uploadMutation.isPending,
  });

  const openItem = useCallback((item: FileManagerItem) => {
    if (item.kind === 'folder') {
      setSelectedFolderId(item.id);
      setKeyword('');
      setIsSearchOpen(false);
      return;
    }
    toast.info(`Đã chọn tệp “${item.name}”.`);
  }, []);

  const quota = quotaQuery.data;
  const quotaPercent = quota
    ? Math.min(
        100,
        ((quota.usedBytes + quota.reservedBytes) / quota.limitBytes) * 100,
      )
    : 0;

  if (foldersQuery.isError || itemsQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md p-8 text-center">
          <FileWarning className="mx-auto mb-3 size-9 text-destructive" />
          <CardTitle>Không tải được kho tệp</CardTitle>
          <CardDescription className="mt-2">
            Kiểm tra cấu hình kho tệp và quyền truy cập của tenant.
          </CardDescription>
          <Button
            className="mt-5"
            variant="outline"
            onClick={() => {
              void foldersQuery.refetch();
              void itemsQuery.refetch();
            }}
          >
            <RefreshCw className="size-4" />
            Thử lại
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 lg:p-5">
      <PageHeader
        title="Tệp lưu trữ"
        icon={FolderOpen}
        className="shrink-0"
        titleAside={
          quota ? (
            <StorageQuotaBadge
              usedBytes={quota.usedBytes}
              limitBytes={quota.limitBytes}
              percent={quotaPercent}
            />
          ) : (
            <span className="text-xs text-muted-foreground">
              Chưa cấu hình quota
            </span>
          )
        }
      />

      <Card className="min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="mb-5 flex min-w-0 items-center justify-between gap-3">
            {isSearchOpen ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="Tìm trong thư mục"
                    className="h-9 ps-8"
                    aria-label="Tìm trong thư mục"
                  />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      mode="icon"
                      size="lg"
                      aria-label="Đóng tìm kiếm"
                      onClick={() => {
                        setIsSearchOpen(false);
                        setKeyword('');
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent variant="light">Đóng tìm kiếm</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <>
                <FolderPath
                  folders={foldersQuery.data ?? []}
                  selectedFolderId={selectedFolderId}
                  tenantName={tenantName}
                  onSelect={setSelectedFolderId}
                />
                <div className="flex shrink-0 items-center gap-1">
                  <div {...dropzone.getRootProps()}>
                    <input {...dropzone.getInputProps()} />
                    <ShortcutTooltip
                      label={
                        !selectedFolderId
                          ? 'Chọn thư mục để tải tệp lên'
                          : 'Thêm tệp'
                      }
                      shortcut="Alt + U"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        mode="icon"
                        size="lg"
                        aria-label="Thêm tệp"
                        aria-keyshortcuts="Alt+U"
                        data-shortcut-action="upload"
                        disabled={!selectedFolderId || uploadMutation.isPending}
                        loading={uploadMutation.isPending}
                      >
                        <Upload className="size-4" />
                      </Button>
                    </ShortcutTooltip>
                  </div>
                  <ShortcutTooltip label="Tạo thư mục" shortcut="Alt + N">
                    <Button
                      type="button"
                      variant="ghost"
                      mode="icon"
                      size="lg"
                      aria-label="Tạo thư mục"
                      aria-keyshortcuts="Alt+N"
                      data-shortcut-action="create"
                      onClick={() => beginCreateFolder(selectedFolderId)}
                    >
                      <FolderPlus className="size-4" />
                    </Button>
                  </ShortcutTooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        mode="icon"
                        size="lg"
                        aria-label="Tìm kiếm"
                        onClick={() => setIsSearchOpen(true)}
                      >
                        <Search className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent variant="light">Tìm kiếm</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        mode="icon"
                        size="lg"
                        aria-label="Làm mới danh sách tệp"
                        onClick={() => void itemsQuery.refetch()}
                      >
                        <RefreshCw
                          className={cn(
                            'size-4',
                            itemsQuery.isFetching && 'animate-spin',
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent variant="light">
                      Làm mới danh sách tệp
                    </TooltipContent>
                  </Tooltip>
                </div>
              </>
            )}
          </div>
          {itemsQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="min-h-36 animate-pulse rounded-xl border border-border bg-muted/40"
                />
              ))}
            </div>
          ) : visibleItems.length > 0 ? (
            <div className="space-y-7">
              {visibleFolders.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                  {visibleFolders.map((item) => (
                    <FileManagerTile
                      key={item.id}
                      item={item}
                      onOpen={openItem}
                      onRename={requestRename}
                      onDelete={requestDelete}
                    />
                  ))}
                </div>
              ) : null}
              {visibleFiles.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                  {visibleFiles.map((item) => (
                    <FileManagerTile
                      key={item.id}
                      item={item}
                      onOpen={openItem}
                      onRename={requestRename}
                      onDelete={requestDelete}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {keyword ? (
                  <Search className="size-7" />
                ) : (
                  <FolderOpen className="size-7" />
                )}
              </span>
              <h2 className="mt-4 text-sm font-semibold">
                {keyword
                  ? 'Không tìm thấy mục phù hợp'
                  : 'Thư mục này đang trống'}
              </h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {keyword
                  ? 'Thử tìm với từ khóa khác hoặc xóa bộ lọc tìm kiếm.'
                  : selectedFolderId
                    ? 'Tải tệp lên hoặc tạo thư mục con để bắt đầu lưu trữ.'
                    : 'Chọn một thư mục để tải tệp lên hoặc mở một thư mục chức năng.'}
              </p>
            </div>
          )}
        </div>
      </Card>
      <FileFolderCreateFormDialog
        open={isCreatingFolder}
        onOpenChange={(open) => {
          if (!open && !folderMutation.isPending) {
            setNewFolderParentId(null);
            setIsCreatingFolder(false);
          }
        }}
        mode="create"
        form={folderForm}
        onSubmit={(values) => folderMutation.mutate(values)}
        isSaving={folderMutation.isPending}
        title="Tạo thư mục"
      />
      <FileRenameDialogShell
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open && !renameMutation.isPending) {
            setEditingItem(null);
            setEditingName('');
          }
        }}
        dialogTitle={`Đổi tên ${editingItem?.kind === 'folder' ? 'thư mục' : 'tệp'}`}
        onCancel={() => {
          setEditingItem(null);
          setEditingName('');
        }}
        onConfirm={() => renameMutation.mutate()}
        isSaving={renameMutation.isPending}
        canConfirm={Boolean(editingName.trim())}
      >
        <div className="flex flex-col gap-2.5">
          <Label htmlFor="file-manager-rename">Tên mới</Label>
          <Input
            id="file-manager-rename"
            autoFocus
            variant="md"
            value={editingName}
            onChange={(event) => setEditingName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && editingName.trim()) {
                renameMutation.mutate();
              }
            }}
          />
        </div>
      </FileRenameDialogShell>
      <ConfirmDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeletingItem(null);
        }}
        title={`Xóa ${deletingItem?.kind === 'folder' ? 'thư mục' : 'tệp'}?`}
        description={
          deletingItem?.kind === 'folder'
            ? `Thư mục “${deletingItem.name}” phải trống trước khi xóa.`
            : `Tệp “${deletingItem?.name ?? ''}” sẽ bị xóa khỏi kho lưu trữ.`
        }
        confirmLabel="Xóa"
        confirmVariant="destructive"
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
