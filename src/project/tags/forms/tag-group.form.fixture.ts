import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'TagGroup',
  schemaImport: '../model/tag',
  schemaName: 'tagGroupFormSchema',
  valuesType: 'TagGroupFormValues',
  title: 'Nhóm danh mục',
  titleMessageId: 'tags.groups.title',
  specPath: 'src/project/tags/forms/tag-group.form.fixture.ts',
  fields: [
    {
      kind: 'text',
      name: 'code',
      label: 'Mã nhóm',
      labelMessageId: 'tags.groups.fields.code',
      width: 'full',
      required: true,
    },
    {
      kind: 'text',
      name: 'name',
      label: 'Tên nhóm',
      labelMessageId: 'tags.groups.fields.name',
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
  ],
};

export default spec;
