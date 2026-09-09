import { describe, expect, it } from 'vitest';
import { buildFileFolderTree, formatFileSize } from './file-manager';

describe('file manager model helpers', () => {
  it('builds the folder tree from entity display names', () => {
    const tree = buildFileFolderTree([
      {
        id: 'contract-1',
        tenantId: 'tenant-1',
        parentId: 'contracts',
        folderType: 'entity',
        systemKey: null,
        subjectType: 'contract',
        subjectId: 'contract-1',
        name: 'HĐ-001 · ABC',
        displayName: 'HĐ-001 · ABC',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        deletedAt: null,
        children: [],
        depth: 0,
      },
      {
        id: 'contracts',
        tenantId: 'tenant-1',
        parentId: null,
        folderType: 'system_root',
        systemKey: 'contracts',
        subjectType: null,
        subjectId: null,
        name: 'Hợp đồng',
        displayName: 'Hợp đồng',
        sortOrder: 20,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        children: [],
        depth: 0,
        deletedAt: null,
      },
    ]);

    expect(tree[0].name).toBe('Hợp đồng');
    expect(tree[0].children[0].name).toBe('HĐ-001 · ABC');
    expect(tree[0].children[0].depth).toBe(1);
  });

  it('formats storage sizes for the quota and file list', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(5 * 1024 * 1024 * 1024)).toBe('5.0 GB');
  });
});
