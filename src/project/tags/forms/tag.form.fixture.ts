import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'Tag',
  schemaImport: '../model/tag',
  schemaName: 'tagFormSchema',
  valuesType: 'TagFormValues',
  title: 'Danh mục',
  titleMessageId: 'tags.items.fields.name',
  specPath: 'src/project/tags/forms/tag.form.fixture.ts',
  fields: [
    {
      kind: 'select',
      name: 'groupId',
      label: 'Nhóm danh mục',
      labelMessageId: 'tags.items.fields.group',
      width: 'full',
      required: true,
      optionsFrom: 'prop',
    },
    {
      kind: 'text',
      name: 'name',
      label: 'Tên danh mục',
      labelMessageId: 'tags.items.fields.name',
      width: 'full',
      required: true,
    },
    {
      kind: 'textarea',
      name: 'description',
      label: 'Mô tả',
      labelMessageId: 'common.fields.description',
      width: 'full',
      rows: 3,
    },
    {
      kind: 'text',
      name: 'code',
      label: 'Mã danh mục',
      labelMessageId: 'tags.items.fields.code',
      width: 'normal',
      required: true,
    },
    {
      kind: 'text',
      name: 'color',
      label: 'Màu',
      labelMessageId: 'tags.items.fields.color',
      width: 'normal',
      required: true,
    },
  ],
};

export default spec;
