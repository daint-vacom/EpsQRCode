import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'FileFolderCreate',
  schemaImport: '../model/file-manager',
  schemaName: 'fileFolderCreateFormSchema',
  valuesType: 'FileFolderCreateFormValues',
  title: 'Tạo thư mục',
  titleMessageId: 'files.actions.createFolder',
  specPath: 'src/project/files/forms/file-folder-create.form.fixture.ts',
  fields: [
    {
      kind: 'text',
      name: 'name',
      label: 'Tên thư mục',
      labelMessageId: 'files.fields.name',
      width: 'full',
      required: true,
    },
  ],
};

export default spec;
