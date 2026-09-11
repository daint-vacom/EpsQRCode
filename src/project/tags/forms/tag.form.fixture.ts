import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'Tag',
  schemaImport: '../model/tag',
  schemaName: 'tagFormSchema',
  valuesType: 'TagFormValues',
  title: 'Danh mục',
  specPath: 'src/project/tags/forms/tag.form.fixture.ts',
  fields: [
    {
      kind: 'select',
      name: 'groupId',
      label: 'Nhóm danh mục',
      width: 'full',
      required: true,
      placeholder: 'Chọn nhóm danh mục',
      optionsFrom: 'prop',
    },
    {
      kind: 'text',
      name: 'name',
      label: 'Tên danh mục',
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
    {
      kind: 'text',
      name: 'code',
      label: 'Mã danh mục',
      width: 'normal',
      required: true,
    },
    {
      kind: 'text',
      name: 'color',
      label: 'Màu',
      width: 'normal',
      required: true,
      placeholder: '#2563eb',
    },
  ],
};

export default spec;
