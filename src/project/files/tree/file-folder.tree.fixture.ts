import type { TreeSpec } from '@/builders/tree';

const spec = {
  entity: 'FileFolder',
  modelImport: '../model/file-manager',
  componentName: 'FileFolderTree',
  panelComponentName: 'FileFolderTreePanel',
  specPath: 'src/project/files/tree/file-folder.tree.fixture.ts',
  includeAllRow: true,
  actions: [
    {
      key: 'add',
      kind: 'add',
      label: 'Tạo thư mục',
      nodeLabel: 'Tạo thư mục con',
    },
  ],
} satisfies TreeSpec;

export default spec;
