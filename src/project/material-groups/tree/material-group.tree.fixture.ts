import type { TreeSpec } from '@/builders/tree';

const spec = {
  entity: 'MaterialGroupTreeNode',
  modelImport: '../model/material-group-tree',
  componentName: 'MaterialGroupTree',
  panelComponentName: 'MaterialGroupTreePanel',
  specPath: 'src/project/material-groups/tree/material-group.tree.fixture.ts',
  includeAllRow: true,
  actions: [
    {
      key: 'add',
      kind: 'add',
      label: 'Thêm nhóm',
      nodeLabel: 'Thêm nhóm con',
      optional: true,
    },
    {
      key: 'edit',
      kind: 'edit',
      label: 'Sửa nhóm',
      optional: true,
    },
    {
      key: 'delete',
      kind: 'delete',
      label: 'Xóa nhóm',
      optional: true,
    },
    {
      key: 'toggleAvailability',
      kind: 'custom',
      label: 'Đổi trạng thái sử dụng',
      icon: 'Power',
      optional: true,
    },
  ],
} satisfies TreeSpec;

export default spec;
