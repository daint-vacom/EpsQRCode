import {
  removeStorageObjects,
  TENANT_ASSETS_BUCKET,
  uploadStorageObject,
} from '@/lib/storage';
import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import {
  formatFileSize,
  type FileFolder,
  type FileManagerItem,
  type TenantStorageQuota,
} from '../model/file-manager';

interface FolderRow {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  folder_type: FileFolder['folderType'];
  system_key: string | null;
  subject_type: FileFolder['subjectType'];
  subject_id: string | null;
  name: string | null;
  display_name: string | null;
  sort_order: number | string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface FileRow {
  id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number | string;
  created_at: string;
}

interface FileStorageRow {
  id: string;
  storage_bucket: string;
  storage_path: string;
}

interface QuotaRow {
  limit_bytes: number | string;
  used_bytes: number | string;
  reserved_bytes: number | string;
  max_file_size_bytes: number | string | null;
}

function queryParams(params: Record<string, string>) {
  return { params };
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

function numberValue(value: number | string | null | undefined) {
  return value == null ? 0 : typeof value === 'number' ? value : Number(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function mapFolder(row: FolderRow): FileFolder {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    parentId: row.parent_id,
    folderType: row.folder_type,
    systemKey: row.system_key,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    name: row.display_name ?? row.name ?? 'Đối tượng đã xóa',
    displayName: row.display_name ?? row.name ?? 'Đối tượng đã xóa',
    sortOrder: numberValue(row.sort_order),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    children: [],
    depth: 0,
  };
}

export async function listFileFolders(tenantId: string): Promise<FileFolder[]> {
  assertSupabaseConfigured();
  const rows = await request<FolderRow[]>(
    supabaseApi.get(
      '/file_folder_listing',
      queryParams({
        select:
          'id,tenant_id,parent_id,folder_type,system_key,subject_type,subject_id,name,display_name,sort_order,created_at,updated_at,deleted_at',
        tenant_id: `eq.${tenantId}`,
        deleted_at: 'is.null',
        order: 'sort_order.asc,display_name.asc',
      }),
    ),
  );
  return rows.map(mapFolder);
}

export async function listFileManagerItems(
  tenantId: string,
  folderId: string | null,
): Promise<FileManagerItem[]> {
  assertSupabaseConfigured();
  const [folderRows, fileRows] = await Promise.all([
    request<FolderRow[]>(
      supabaseApi.get(
        '/file_folder_listing',
        queryParams({
          select:
            'id,tenant_id,parent_id,folder_type,system_key,subject_type,subject_id,name,display_name,sort_order,created_at,updated_at,deleted_at',
          tenant_id: `eq.${tenantId}`,
          parent_id: folderId ? `eq.${folderId}` : 'is.null',
          deleted_at: 'is.null',
          order: 'folder_type.asc,display_name.asc',
        }),
      ),
    ),
    request<FileRow[]>(
      supabaseApi.get(
        '/files',
        queryParams({
          select:
            'id,storage_bucket,storage_path,file_name,mime_type,size_bytes,created_at',
          tenant_id: `eq.${tenantId}`,
          folder_id: folderId ? `eq.${folderId}` : 'is.null',
          status: 'eq.active',
          order: 'created_at.desc',
        }),
      ),
    ),
  ]);

  return [
    ...folderRows.map((row) => ({
      id: row.id,
      kind: 'folder' as const,
      name: row.display_name ?? row.name ?? 'Đối tượng đã xóa',
      mimeType: 'Folder',
      sizeBytes: 0,
      sizeLabel: '—',
      modifiedAt: row.updated_at,
      modifiedAtLabel: formatDateTime(row.updated_at),
      folderType: row.folder_type,
      systemKey: row.system_key,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      folderId: row.id,
    })),
    ...fileRows.map((row) => ({
      id: row.id,
      kind: 'file' as const,
      name: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: numberValue(row.size_bytes),
      sizeLabel: formatFileSize(numberValue(row.size_bytes)),
      modifiedAt: row.created_at,
      modifiedAtLabel: formatDateTime(row.created_at),
      folderId,
      storageBucket: row.storage_bucket,
      storagePath: row.storage_path,
    })),
  ];
}

export async function getTenantStorageQuota(
  tenantId: string,
): Promise<TenantStorageQuota | null> {
  assertSupabaseConfigured();
  const rows = await request<QuotaRow[]>(
    supabaseApi.get(
      '/tenant_storage_quotas',
      queryParams({
        select: 'limit_bytes,used_bytes,reserved_bytes,max_file_size_bytes',
        tenant_id: `eq.${tenantId}`,
        limit: '1',
      }),
    ),
  );
  const row = rows[0];
  return row
    ? {
        limitBytes: numberValue(row.limit_bytes),
        usedBytes: numberValue(row.used_bytes),
        reservedBytes: numberValue(row.reserved_bytes),
        maxFileSizeBytes:
          row.max_file_size_bytes == null
            ? null
            : numberValue(row.max_file_size_bytes),
      }
    : null;
}

export async function createCustomFileFolder(
  tenantId: string,
  parentId: string | null,
  name: string,
  userId: string,
) {
  assertSupabaseConfigured();
  await request(
    supabaseApi.post(
      '/file_folders',
      {
        tenant_id: tenantId,
        parent_id: parentId,
        name: name.trim(),
        folder_type: 'custom',
        created_by: userId,
      },
      { headers: { Prefer: 'return=minimal' } },
    ),
  );
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

export interface UploadFilesToFolderOptions {
  onProgress?: (file: File, progress: number) => void;
}

export async function uploadFilesToFolder(
  tenantId: string,
  folderId: string | null,
  userId: string,
  files: File[],
  options?: UploadFilesToFolderOptions,
) {
  assertSupabaseConfigured();
  const uploadedPaths: string[] = [];
  const fileIds: string[] = [];

  try {
    for (const file of files) {
      const fileId = crypto.randomUUID();
      const storagePath = `${tenantId}/objects/${fileId}/${safeFileName(file.name)}`;

      options?.onProgress?.(file, 0);

      await uploadStorageObject({
        bucket: TENANT_ASSETS_BUCKET,
        path: storagePath,
        file,
        onProgress: ({ loaded, total }) => {
          const progress = total
            ? Math.min(99, Math.round((loaded / total) * 99))
            : 0;
          options?.onProgress?.(file, progress);
        },
      });
      uploadedPaths.push(storagePath);
      fileIds.push(fileId);

      await request(
        supabaseApi.post(
          '/files',
          {
            id: fileId,
            tenant_id: tenantId,
            folder_id: folderId,
            storage_bucket: TENANT_ASSETS_BUCKET,
            storage_path: storagePath,
            file_name: file.name,
            mime_type: file.type || 'application/octet-stream',
            size_bytes: file.size,
            uploaded_by: userId,
          },
          { headers: { Prefer: 'return=minimal' } },
        ),
      );
      options?.onProgress?.(file, 100);
    }
  } catch (error) {
    if (fileIds.length > 0) {
      await supabaseApi
        .delete(
          '/files',
          queryParams({
            tenant_id: `eq.${tenantId}`,
            id: `in.(${fileIds.join(',')})`,
          }),
        )
        .catch(() => undefined);
    }
    await removeStorageObjects(TENANT_ASSETS_BUCKET, uploadedPaths).catch(
      () => undefined,
    );
    throw error;
  }
}

export async function renameFileManagerItem(
  tenantId: string,
  item: FileManagerItem,
  name: string,
) {
  assertSupabaseConfigured();
  const nextName = name.trim();
  if (!nextName) throw new Error('Tên mục không được để trống.');
  if (item.kind === 'folder' && item.folderType !== 'custom') {
    throw new Error(
      'Thư mục hệ thống hoặc thư mục liên kết không thể đổi tên.',
    );
  }

  await request(
    supabaseApi.patch(
      item.kind === 'folder' ? '/file_folders' : '/files',
      item.kind === 'folder' ? { name: nextName } : { file_name: nextName },
      {
        ...queryParams({ tenant_id: `eq.${tenantId}`, id: `eq.${item.id}` }),
        headers: { Prefer: 'return=minimal' },
      },
    ),
  );
}

export async function deleteFileManagerItem(
  tenantId: string,
  item: FileManagerItem,
) {
  assertSupabaseConfigured();

  if (item.kind === 'folder') {
    if (item.folderType !== 'custom') {
      throw new Error('Thư mục hệ thống hoặc thư mục liên kết không thể xóa.');
    }

    const [childFolders, childFiles] = await Promise.all([
      request<FolderRow[]>(
        supabaseApi.get(
          '/file_folders',
          queryParams({
            select: 'id',
            tenant_id: `eq.${tenantId}`,
            parent_id: `eq.${item.id}`,
            deleted_at: 'is.null',
            limit: '1',
          }),
        ),
      ),
      request<FileRow[]>(
        supabaseApi.get(
          '/files',
          queryParams({
            select: 'id',
            tenant_id: `eq.${tenantId}`,
            folder_id: `eq.${item.id}`,
            status: 'eq.active',
            limit: '1',
          }),
        ),
      ),
    ]);

    if (childFolders.length > 0 || childFiles.length > 0) {
      throw new Error('Hãy xóa các mục bên trong thư mục trước.');
    }

    await request(
      supabaseApi.patch(
        '/file_folders',
        { deleted_at: new Date().toISOString() },
        {
          ...queryParams({ tenant_id: `eq.${tenantId}`, id: `eq.${item.id}` }),
          headers: { Prefer: 'return=minimal' },
        },
      ),
    );
    return;
  }

  const links = await request<{ id: string }[]>(
    supabaseApi.get(
      '/file_links',
      queryParams({
        select: 'id',
        tenant_id: `eq.${tenantId}`,
        file_id: `eq.${item.id}`,
        limit: '1',
      }),
    ),
  );
  if (links.length > 0) {
    throw new Error(
      'Tệp đang được liên kết với nghiệp vụ khác và không thể xóa tại đây.',
    );
  }

  const files = await request<FileStorageRow[]>(
    supabaseApi.get(
      '/files',
      queryParams({
        select: 'id,storage_bucket,storage_path',
        tenant_id: `eq.${tenantId}`,
        id: `eq.${item.id}`,
        limit: '1',
      }),
    ),
  );
  if (files.length === 0) throw new Error('Không tìm thấy tệp để xóa.');

  await request(
    supabaseApi.delete(
      '/files',
      queryParams({ tenant_id: `eq.${tenantId}`, id: `eq.${item.id}` }),
    ),
  );
  await removeStorageObjects(
    files[0].storage_bucket,
    files.map((file) => file.storage_path),
  );
}
