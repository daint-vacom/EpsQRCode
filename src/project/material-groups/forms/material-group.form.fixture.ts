import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'MaterialGroup',
  schemaImport: '../model/material-group',
  schemaName: 'materialGroupFormSchema',
  valuesType: 'MaterialGroupFormValues',
  title: 'Thêm nhóm vật tư',
  titleMessageId: 'materialGroups.dialogs.createTitle',
  specPath: 'src/project/material-groups/forms/material-group.form.fixture.ts',
  fields: [
    {
      kind: 'text',
      name: 'code',
      label: 'Mã nhóm',
      labelMessageId: 'materialGroups.fields.code',
      width: 'full',
      layout: 'horizontal',
      labelWidth: 'md',
      alignment: 'first-control',
      required: true,
    },
    {
      kind: 'text',
      name: 'name',
      label: 'Tên nhóm',
      labelMessageId: 'materialGroups.fields.name',
      width: 'full',
      layout: 'horizontal',
      labelWidth: 'md',
      required: true,
    },
    {
      kind: 'textarea',
      name: 'description',
      label: 'Mô tả',
      labelMessageId: 'materialGroups.fields.description',
      width: 'full',
      layout: 'horizontal',
      labelWidth: 'md',
      alignment: 'start',
      rows: 3,
    },
  ],
};

export default spec;
