import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'FileFolderCreate',
  schemaImport: '../model/file-manager',
  schemaName: 'fileFolderCreateFormSchema',
  valuesType: 'FileFolderCreateFormValues',
  title: 'Tạo thư mục',
  specPath: 'src/project/files/forms/file-folder-create.form.fixture.ts',
  fields: [
    {
      kind: 'text',
      name: 'name',
      label: 'Tên thư mục',
      width: 'full',
      required: true,
      placeholder: 'Nhập tên thư mục',
    },
  ],
};

export default spec;
