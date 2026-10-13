import { z } from 'zod';

export type FileFolderType = 'system_root' | 'entity' | 'custom';
export type FileSubjectType = string;

export interface FileFolder {
  id: string;
  parentId: string | null;
  folderType: FileFolderType;
  systemKey: string | null;
  subjectType: FileSubjectType | null;
  subjectId: string | null;
  /** Resolved display name; entity folders are joined to their source record. */
  name: string;
  displayName: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  children: FileFolder[];
  depth: number;
}

export type FileManagerItemKind = 'folder' | 'file';

export interface FileManagerItem {
  id: string;
  kind: FileManagerItemKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  sizeLabel: string;
  modifiedAt: string;
  modifiedAtLabel: string;
  folderType?: FileFolderType;
  systemKey?: string | null;
  subjectType?: FileSubjectType | null;
  subjectId?: string | null;
  linkedEntity?: string | null;
  folderId: string | null;
  storageBucket?: string;
  storagePath?: string;
}

export const fileFolderCreateFormSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên thư mục.'),
});

export type FileFolderCreateFormValues = z.infer<
  typeof fileFolderCreateFormSchema
>;

export const fileFolderCreateDefaultValues: FileFolderCreateFormValues = {
  name: '',
};

export function buildFileFolderTree(folders: FileFolder[]): FileFolder[] {
  const byId = new Map<string, FileFolder>();
  for (const folder of folders) {
    byId.set(folder.id, { ...folder, children: [], depth: 0 });
  }

  const roots: FileFolder[] = [];
  for (const folder of byId.values()) {
    if (folder.parentId && byId.has(folder.parentId)) {
      byId.get(folder.parentId)!.children.push(folder);
    } else {
      roots.push(folder);
    }
  }

  const sort = (nodes: FileFolder[], depth: number) => {
    nodes.sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.displayName.localeCompare(right.displayName, 'vi'),
    );
    for (const node of nodes) {
      node.depth = depth;
      sort(node.children, depth + 1);
    }
  };

  sort(roots, 0);
  return roots;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 0; value >= 1024 && index < units.length - 1; index += 1) {
    value /= 1024;
    unit = units[index + 1];
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}
