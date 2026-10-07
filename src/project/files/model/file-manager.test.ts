import { describe, expect, it } from 'vitest';
import { buildFileFolderTree, formatFileSize } from './file-manager';

describe('file manager model helpers', () => {
  it('builds the folder tree from stored display names', () => {
    const tree = buildFileFolderTree([
      {
        id: 'folder-1',
        tenantId: 'tenant-1',
        parentId: 'shared-files',
        folderType: 'custom',
        systemKey: null,
        subjectType: null,
        subjectId: null,
        name: 'Tài liệu dùng chung',
        displayName: 'Tài liệu dùng chung',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        deletedAt: null,
        children: [],
        depth: 0,
      },
      {
        id: 'shared-files',
        tenantId: 'tenant-1',
        parentId: null,
        folderType: 'system_root',
        systemKey: null,
        subjectType: null,
        subjectId: null,
        name: 'Tệp dùng chung',
        displayName: 'Tệp dùng chung',
        sortOrder: 20,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        children: [],
        depth: 0,
        deletedAt: null,
      },
    ]);

    expect(tree[0].name).toBe('Tệp dùng chung');
    expect(tree[0].children[0].name).toBe('Tài liệu dùng chung');
    expect(tree[0].children[0].depth).toBe(1);
  });

  it('formats storage sizes for the quota and file list', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(5 * 1024 * 1024 * 1024)).toBe('5.0 GB');
  });
});
