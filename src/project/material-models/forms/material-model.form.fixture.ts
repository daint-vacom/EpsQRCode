import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'MaterialModel',
  schemaImport: '../model/material-model',
  schemaName: 'materialModelFormSchema',
  valuesType: 'MaterialModelFormValues',
  title: 'Mẫu vật tư',
  titleMessageId: 'materialModels.dialogs.createTitle',
  specPath: 'src/project/material-models/forms/material-model.form.fixture.ts',
  fields: [
    {
      kind: 'text',
      name: 'code',
      label: 'Mã mẫu',
      labelMessageId: 'materialModels.fields.code',
      width: 'full',
      layout: 'horizontal',
      labelWidth: 'md',
      required: true,
    },
    {
      kind: 'text',
      name: 'name',
      label: 'Tên mẫu',
      labelMessageId: 'materialModels.fields.name',
      width: 'full',
      layout: 'horizontal',
      labelWidth: 'md',
      required: true,
    },
    {
      kind: 'text',
      name: 'imageUrl',
      label: 'Ảnh đại diện',
      labelMessageId: 'materialModels.fields.imageUrl',
      width: 'full',
      layout: 'horizontal',
      labelWidth: 'md',
    },
    {
      kind: 'textarea',
      name: 'description',
      label: 'Mô tả',
      labelMessageId: 'materialModels.fields.description',
      width: 'full',
      layout: 'horizontal',
      labelWidth: 'md',
      rows: 3,
    },
  ],
};

export default spec;
