import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'TagGroup',
  schemaImport: '../model/tag',
  schemaName: 'tagGroupFormSchema',
  valuesType: 'TagGroupFormValues',
  title: 'Nhóm danh mục',
  specPath: 'src/project/tags/forms/tag-group.form.fixture.ts',
  fields: [
    {
      kind: 'text',
      name: 'code',
      label: 'Mã nhóm',
      width: 'full',
      required: true,
    },
    {
      kind: 'text',
      name: 'name',
      label: 'Tên nhóm',
      width: 'full',
      required: true,
    },
    {
      kind: 'textarea',
      name: 'description',
      label: 'Mô tả',
      width: 'full',
      rows: 3,
    },
  ],
};

export default spec;
