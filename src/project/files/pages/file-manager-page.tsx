import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildOfficeViewerUrl,
  isOfficeDocument,
} from '@/project/files/model/file';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  FolderOpen,
  FolderPlus,
  MoreVertical,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { PROJECT_FEATURE_ICONS } from '@/config/project-feature-icons';
import { getApiErrorMessage } from '@/lib/errors';
import { createSignedStorageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ErrorState } from '@/components/ui/error-state';
import { FileIcon } from '@/components/ui/files/file-icon';
import { FileThumbnail } from '@/components/ui/files/file-thumbnail';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/inputs/search-input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  createCustomFileFolder,
  deleteFileManagerItem,
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
  type FileFolder,
  type FileFolderCreateFormValues,
  type FileManagerItem,
} from '../model/file-manager';

type UploadQueueItemStatus = 'queued' | 'uploading' | 'success' | 'error';

interface UploadQueueItem {
  id: string;
  file: File;
  progress: number;
  status: UploadQueueItemStatus;
  error?: string;
}

function UploadQueuePanel({
  items,
  expanded,
  onToggle,
  onClose,
}: {
  items: UploadQueueItem[];
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const pendingCount = items.filter(
    (item) => item.status === 'queued' || item.status === 'uploading',
  ).length;
  const successCount = items.filter((item) => item.status === 'success').length;
  const errorCount = items.filter((item) => item.status === 'error').length;
  const isComplete = pendingCount === 0;

  const title = !isComplete
    ? `Đang tải lên ${successCount}/${items.length} tệp`
    : errorCount > 0
      ? `Hoàn tất với ${errorCount} lỗi`
      : `Đã tải lên ${items.length} tệp`;

  return (
    <section
      className="fixed inset-x-4 bottom-4 z-50 overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:end-5 sm:w-[min(25rem,calc(100vw-2.5rem))]"
      aria-label="Tiến trình tải tệp"
    >
      <header className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {isComplete ? (
            errorCount > 0 ? (
              <CircleAlert className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )
          ) : (
            <Upload className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {title}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          mode="icon"
          size="sm"
          aria-label={
            expanded ? 'Thu gọn tiến trình tải tệp' : 'Mở tiến trình tải tệp'
          }
          onClick={onToggle}
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronUp className="size-4" />
          )}
        </Button>
        {isComplete ? (
          <Button
            type="button"
            variant="ghost"
            mode="icon"
            size="sm"
            aria-label="Đóng tiến trình tải tệp"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </header>
      {expanded ? (
        <div className="max-h-80 space-y-3 overflow-y-auto p-3">
          {items.map((item) => (
            <div key={item.id} className="min-w-0 space-y-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <FileIcon
                  fileType={item.file.type}
                  fileName={item.file.name}
                  alt=""
                  className="size-5 shrink-0"
                />
                <span
                  className="min-w-0 flex-1 truncate text-xs font-medium text-foreground"
                  title={item.file.name}
                >
                  {item.file.name}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {item.status === 'queued' ? (
                    'Đang chờ'
                  ) : item.status === 'uploading' ? (
                    `${item.progress}%`
                  ) : item.status === 'success' ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <CircleAlert className="size-4 text-destructive" />
                  )}
                </span>
              </div>
              {item.status === 'queued' || item.status === 'uploading' ? (
                <Progress value={item.progress} className="h-1.5" />
              ) : item.status === 'error' ? (
                <p
                  className="truncate text-[11px] text-destructive"
                  title={item.error}
                >
                  {item.error ?? 'Không thể tải tệp lên.'}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FileManagerItemMenu({
  item,
  onRename,
  onDelete,
  canManage,
}: {
  item: FileManagerItem;
  onRename: (item: FileManagerItem) => void;
  onDelete: (item: FileManagerItem) => void;
  canManage: boolean;
}) {
  const canEdit =
    canManage && (item.kind === 'file' || item.folderType === 'custom');

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
        <TooltipContent>Tùy chọn</TooltipContent>
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

function getFolderIcon() {
  return FolderOpen;
}

function FileManagerTile({
  item,
  onOpen,
  onRename,
  onDelete,
  canManage,
  isOpening,
}: {
  item: FileManagerItem;
  onOpen: (item: FileManagerItem) => void;
  onRename: (item: FileManagerItem) => void;
  onDelete: (item: FileManagerItem) => void;
  canManage: boolean;
  isOpening: boolean;
}) {
  const isFolder = item.kind === 'folder';
  const FolderIcon = getFolderIcon();

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
          disabled={isOpening}
          className="flex min-w-0 flex-1 items-center gap-2 text-start focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
          onDoubleClick={() => onOpen(item)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpen(item);
            }
          }}
        >
          {isFolder ? (
            <FolderIcon className="size-4 shrink-0 text-admin-blue-dark" />
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
            <TooltipContent className="max-w-sm break-all">
              {item.name}
            </TooltipContent>
          </Tooltip>
        </button>
        <FileManagerItemMenu
          item={item}
          onRename={onRename}
          onDelete={onDelete}
          canManage={canManage}
        />
      </div>

      {!isFolder ? (
        <>
          <div
            role="button"
            tabIndex={isOpening ? -1 : 0}
            aria-disabled={isOpening}
            className="mt-1 flex aspect-[1.55] w-full items-center justify-center rounded-lg bg-background p-5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-wait aria-disabled:opacity-60"
            onDoubleClick={() => {
              if (!isOpening) onOpen(item);
            }}
            onKeyDown={(event) => {
              if (isOpening) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpen(item);
              }
            }}
            aria-label={`Mở tệp ${item.name}`}
          >
            <FileThumbnail
              mimeType={item.mimeType}
              fileName={item.name}
              storageBucket={item.storageBucket}
              storagePath={item.storagePath}
              className="size-full"
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-1 pt-2 text-[11px] text-muted-foreground">
            <span className="truncate">{item.sizeLabel}</span>
            <span className="shrink-0">{item.modifiedAtLabel}</span>
          </div>
        </>
      ) : null}
    </article>
  );
}

function FileManagerTileSkeleton({ isFolder }: { isFolder: boolean }) {
  if (isFolder) {
    return (
      <Skeleton
        aria-hidden="true"
        className="h-14 min-w-0 self-start rounded-xl bg-muted/45"
      />
    );
  }

  return (
    <div aria-hidden="true" className="relative min-h-56 min-w-0">
      <Skeleton className="absolute inset-0 rounded-xl bg-muted/35" />
      <Skeleton className="absolute inset-x-2 top-11 aspect-[1.55] rounded-lg bg-muted/65" />
    </div>
  );
}

function FileManagerLoadingSkeleton() {
  return (
    <div className="space-y-7" aria-label="Đang tải danh sách tệp">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <FileManagerTileSkeleton key={`folder-${index}`} isFolder />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <FileManagerTileSkeleton key={`file-${index}`} isFolder={false} />
        ))}
      </div>
    </div>
  );
}

function FolderPath({
  folders,
  selectedFolderId,
  workspaceName,
  onSelect,
}: {
  folders: FileFolder[];
  selectedFolderId: string | null;
  workspaceName: string;
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
              {workspaceName}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onSelect(null);
              }}
            >
              {workspaceName}
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
  const intl = useIntl();
  const { userId, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission('files:file_manager:view');
  const canManage = hasPermission('files:file_manager:manage');
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
  const [openingItemId, setOpeningItemId] = useState<string | null>(null);
  const [uploadItems, setUploadItems] = useState<UploadQueueItem[]>([]);
  const [isUploadPanelExpanded, setIsUploadPanelExpanded] = useState(true);
  const folderForm = useFileFolderCreateForm();

  const foldersQuery = useQuery({
    queryKey: ['project', 'file-manager', 'folders'],
    queryFn: () => listFileFolders(),
    enabled: !isPermissionsPending && canView,
  });
  const itemsQuery = useQuery({
    queryKey: ['project', 'file-manager', 'items', selectedFolderId],
    queryFn: () => listFileManagerItems(selectedFolderId),
    enabled: !isPermissionsPending && canView,
  });
  const selectedFolder = useMemo(
    () =>
      selectedFolderId
        ? (foldersQuery.data?.find(
            (folder) => folder.id === selectedFolderId,
          ) ?? null)
        : null,
    [foldersQuery.data, selectedFolderId],
  );
  const canUploadToCurrentFolder =
    canManage &&
    (selectedFolderId === null ||
      selectedFolder?.folderType === 'entity' ||
      selectedFolder?.folderType === 'custom');
  const canCreateFolderInCurrentFolder =
    canManage &&
    (selectedFolderId === null || selectedFolder?.folderType === 'custom');

  const beginCreateFolder = useCallback((parentId: string | null) => {
    setNewFolderParentId(parentId);
    setIsCreatingFolder(true);
  }, []);

  useEffect(() => {
    if (isCreatingFolder) folderForm.reset(fileFolderCreateDefaultValues);
  }, [folderForm, isCreatingFolder]);

  const visibleItems = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase('vi');
    return [...(itemsQuery.data ?? [])]
      .filter(
        (item) =>
          !normalized || item.name.toLocaleLowerCase('vi').includes(normalized),
      )
      .sort((left, right) =>
        left.name.localeCompare(right.name, 'vi', {
          numeric: true,
          sensitivity: 'base',
        }),
      );
  }, [itemsQuery.data, keyword]);
  const visibleSystemFolders = useMemo(
    () =>
      visibleItems.filter(
        (item) => item.kind === 'folder' && item.folderType === 'system_root',
      ),
    [visibleItems],
  );
  const visibleOtherFolders = useMemo(
    () =>
      visibleItems.filter(
        (item) => item.kind === 'folder' && item.folderType !== 'system_root',
      ),
    [visibleItems],
  );
  const visibleFiles = useMemo(
    () => visibleItems.filter((item) => item.kind === 'file'),
    [visibleItems],
  );

  const folderMutation = useMutation({
    mutationFn: (values: FileFolderCreateFormValues) => {
      if (!userId) {
        throw new Error('Chưa xác định người dùng.');
      }
      return createCustomFileFolder(newFolderParentId, values.name, userId);
    },
    onSuccess: () => {
      toast.success('Đã tạo thư mục.');
      folderForm.reset(fileFolderCreateDefaultValues);
      setNewFolderParentId(null);
      setIsCreatingFolder(false);
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'folders'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'items'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateUploadItem = useCallback(
    (itemId: string, update: Partial<UploadQueueItem>) => {
      setUploadItems((currentItems) =>
        currentItems.map((item) =>
          item.id === itemId ? { ...item, ...update } : item,
        ),
      );
    },
    [],
  );

  interface UploadBatch {
    folderId: string | null;
    items: UploadQueueItem[];
  }

  const uploadMutation = useMutation({
    mutationFn: async ({ folderId, items }: UploadBatch) => {
      if (!userId) {
        throw new Error('Chưa xác định người dùng.');
      }

      let successCount = 0;
      let failedCount = 0;

      for (const item of items) {
        updateUploadItem(item.id, { status: 'uploading', progress: 0 });

        try {
          await uploadFilesToFolder(folderId, userId, [item.file], {
            onProgress: (_, progress) =>
              updateUploadItem(item.id, { progress }),
          });
          updateUploadItem(item.id, { status: 'success', progress: 100 });
          successCount += 1;
        } catch (error) {
          updateUploadItem(item.id, {
            status: 'error',
            error: getApiErrorMessage(error),
          });
          failedCount += 1;
        }
      }

      return { folderId, successCount, failedCount };
    },
    onSuccess: ({ folderId, successCount, failedCount }) => {
      if (failedCount === 0) {
        toast.success(`Đã tải lên ${successCount} tệp.`);
      } else if (successCount > 0) {
        toast.warning(
          `Đã tải lên ${successCount} tệp, ${failedCount} tệp không thành công.`,
        );
      } else {
        toast.error('Không thể tải các tệp đã chọn lên kho lưu trữ.');
      }
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'items', folderId],
      });
    },
    onError: (error, variables) => {
      const errorMessage = getApiErrorMessage(error);
      if (variables) {
        variables.items.forEach((item) =>
          updateUploadItem(item.id, { status: 'error', error: errorMessage }),
        );
      }
      toast.error(errorMessage);
    },
  });

  const renameMutation = useMutation({
    mutationFn: () => {
      if (!editingItem) {
        throw new Error('Không tìm thấy mục cần đổi tên.');
      }
      return renameFileManagerItem(editingItem, editingName);
    },
    onSuccess: () => {
      toast.success('Đã đổi tên mục.');
      setEditingItem(null);
      setEditingName('');
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'folders'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'items'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (item: FileManagerItem) => {
      return deleteFileManagerItem(item);
    },
    onSuccess: () => {
      toast.success('Đã xóa mục.');
      setDeletingItem(null);
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'folders'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['project', 'file-manager', 'items'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const requestRename = useCallback(
    (item: FileManagerItem) => {
      if (!canManage) return;
      setEditingItem(item);
      setEditingName(item.name);
    },
    [canManage],
  );

  const requestDelete = useCallback(
    (item: FileManagerItem) => {
      if (!canManage) return;
      setDeletingItem(item);
    },
    [canManage],
  );

  const onDrop = useCallback(
    (files: File[]) => {
      if (!canManage || !canUploadToCurrentFolder || files.length === 0) return;

      const items = files.map<UploadQueueItem>((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: 'queued',
      }));
      setUploadItems(items);
      setIsUploadPanelExpanded(true);
      uploadMutation.mutate({ folderId: selectedFolderId, items });
    },
    [canManage, canUploadToCurrentFolder, selectedFolderId, uploadMutation],
  );
  const dropzone = useDropzone({
    onDrop,
    multiple: true,
    noClick: true,
    noKeyboard: true,
    disabled: uploadMutation.isPending || !canManage,
  });

  const openItem = useCallback(async (item: FileManagerItem) => {
    if (item.kind === 'folder') {
      setSelectedFolderId(item.id);
      setKeyword('');
      setIsSearchOpen(false);
      return;
    }

    if (!item.storageBucket || !item.storagePath) {
      toast.error('Không tìm thấy đường dẫn lưu trữ của tệp.');
      return;
    }

    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      toast.error(
        'Trình duyệt đang chặn cửa sổ xem tệp. Hãy cho phép popup rồi thử lại.',
      );
      return;
    }

    previewWindow.opener = null;
    setOpeningItemId(item.id);

    try {
      const signedUrl = await createSignedStorageUrl(
        item.storageBucket,
        item.storagePath,
      );
      previewWindow.location.href = isOfficeDocument({
        fileName: item.name,
        mimeType: item.mimeType,
      })
        ? buildOfficeViewerUrl(signedUrl)
        : signedUrl;
    } catch (error) {
      previewWindow.close();
      toast.error(getApiErrorMessage(error));
    } finally {
      setOpeningItemId(null);
    }
  }, []);

  if (isPermissionsPending) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 lg:p-5">
        <PageHeader
          title="Tệp lưu trữ"
          icon={PROJECT_FEATURE_ICONS.files}
          className="shrink-0"
        />
        <Card className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <FileManagerLoadingSkeleton />
        </Card>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 lg:p-5">
        <PageHeader
          title="Tệp lưu trữ"
          icon={PROJECT_FEATURE_ICONS.files}
          className="shrink-0"
        />
        <ErrorState
          title={intl.formatMessage({ id: 'files.errors.authorizationTitle' })}
          description={intl.formatMessage({ id: 'files.errors.authorization' })}
        />
      </div>
    );
  }

  if (foldersQuery.isError || itemsQuery.isError) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 lg:p-5">
        <PageHeader
          title="Tệp lưu trữ"
          icon={PROJECT_FEATURE_ICONS.files}
          className="shrink-0"
        />
        <Card className="flex min-h-0 flex-1 flex-col">
          <ErrorState
            title="Không tải được kho tệp"
            description={getApiErrorMessage(
              foldersQuery.error ?? itemsQuery.error,
            )}
            onRetry={() => {
              void foldersQuery.refetch();
              void itemsQuery.refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 lg:p-5">
      <PageHeader
        title={<span className="sr-only">Tệp lưu trữ</span>}
        icon={PROJECT_FEATURE_ICONS.files}
        titleAside={
          <FolderPath
            folders={foldersQuery.data ?? []}
            selectedFolderId={selectedFolderId}
            workspaceName="Tệp lưu trữ"
            onSelect={setSelectedFolderId}
          />
        }
        actions={
          isSearchOpen ? (
            <div className="flex w-48 min-w-0 items-center gap-1 sm:w-56">
              <SearchInput
                autoFocus
                value={keyword}
                onSearch={setKeyword}
                placeholder={intl.formatMessage({
                  id: 'files.filters.searchContents',
                })}
                className="h-9 min-w-0 flex-1"
                aria-label={intl.formatMessage({
                  id: 'files.filters.searchContents',
                })}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    mode="icon"
                    size="md"
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    mode="icon"
                    size="md"
                    aria-label="Tìm kiếm"
                    onClick={() => setIsSearchOpen(true)}
                  >
                    <Search className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent variant="light">Tìm kiếm</TooltipContent>
              </Tooltip>
              <ShortcutTooltip
                label={
                  canUploadToCurrentFolder
                    ? 'Thêm tệp'
                    : 'Không thể thêm tệp trong thư mục hệ thống'
                }
                shortcut="Alt + U"
              >
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="ghost"
                    mode="icon"
                    size="md"
                    aria-label="Thêm tệp"
                    aria-keyshortcuts="Alt+U"
                    data-shortcut-action="upload"
                    disabled={
                      !canUploadToCurrentFolder || uploadMutation.isPending
                    }
                    loading={uploadMutation.isPending}
                    onClick={dropzone.open}
                  >
                    <Upload className="size-4" />
                  </Button>
                </span>
              </ShortcutTooltip>
              <ShortcutTooltip
                label={
                  canCreateFolderInCurrentFolder
                    ? 'Tạo thư mục'
                    : selectedFolder?.folderType === 'entity'
                      ? 'Không thể tạo thư mục trong thư mục đối tượng'
                      : 'Không thể tạo thư mục trong thư mục hệ thống'
                }
                shortcut="Alt + N"
              >
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="ghost"
                    mode="icon"
                    size="md"
                    aria-label="Tạo thư mục"
                    aria-keyshortcuts="Alt+N"
                    data-shortcut-action="create"
                    disabled={!canCreateFolderInCurrentFolder}
                    onClick={() => beginCreateFolder(selectedFolderId)}
                  >
                    <FolderPlus className="size-4" />
                  </Button>
                </span>
              </ShortcutTooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    mode="icon"
                    size="md"
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
            </>
          )
        }
        className="shrink-0"
      />

      <Card
        {...dropzone.getRootProps({
          className: cn(
            'relative min-h-0 flex-1 overflow-hidden transition-colors',
            dropzone.isDragActive &&
              'border-primary bg-primary/5 ring-2 ring-primary/20',
          ),
          'aria-label': canUploadToCurrentFolder
            ? 'Khu vực tải tệp lên'
            : 'Danh sách tệp',
        })}
      >
        <input {...dropzone.getInputProps()} />
        {dropzone.isDragActive && canUploadToCurrentFolder ? (
          <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-center text-primary">
              <Upload className="size-8" />
              <span className="text-sm font-semibold">
                Thả tệp hoặc thư mục để tải lên
              </span>
            </div>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {itemsQuery.isLoading ? (
            <FileManagerLoadingSkeleton />
          ) : visibleItems.length > 0 ? (
            <div className="space-y-7">
              {visibleSystemFolders.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                  {visibleSystemFolders.map((item) => (
                    <FileManagerTile
                      key={item.id}
                      item={item}
                      onOpen={openItem}
                      onRename={requestRename}
                      onDelete={requestDelete}
                      canManage={canManage}
                      isOpening={openingItemId === item.id}
                    />
                  ))}
                </div>
              ) : null}
              {visibleOtherFolders.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                  {visibleOtherFolders.map((item) => (
                    <FileManagerTile
                      key={item.id}
                      item={item}
                      onOpen={openItem}
                      onRename={requestRename}
                      onDelete={requestDelete}
                      canManage={canManage}
                      isOpening={openingItemId === item.id}
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
                      canManage={canManage}
                      isOpening={openingItemId === item.id}
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
                    : 'Tải tệp lên hoặc mở một thư mục chức năng để bắt đầu lưu trữ.'}
              </p>
            </div>
          )}
        </div>
      </Card>
      {uploadItems.length > 0 ? (
        <UploadQueuePanel
          items={uploadItems}
          expanded={isUploadPanelExpanded}
          onToggle={() => setIsUploadPanelExpanded((expanded) => !expanded)}
          onClose={() => setUploadItems([])}
        />
      ) : null}
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
          <Label htmlFor="file-manager-rename">
            {intl.formatMessage({ id: 'files.fields.name' })}
          </Label>
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
        isConfirming={deleteMutation.isPending}
        closeOnConfirm={false}
        onConfirm={() => {
          if (deletingItem) deleteMutation.mutate(deletingItem);
        }}
      />
    </div>
  );
}
