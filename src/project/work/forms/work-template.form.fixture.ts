import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'WorkTemplate',
  schemaImport: '../model/work',
  schemaName: 'workTemplateFormSchema',
  valuesType: 'WorkTemplateFormValues',
  title: 'Thêm mẫu công việc',
  description: 'Định nghĩa các bước thường lặp lại để tạo công việc nhanh hơn.',
  specPath: 'src/project/work/forms/work-template.form.fixture.ts',
  fields: [
    {
      kind: 'text',
      name: 'code',
      label: 'Mã mẫu',
      width: 'normal',
      required: true,
    },
    {
      kind: 'text',
      name: 'name',
      label: 'Tên mẫu',
      width: 'normal',
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
      kind: 'textarea',
      name: 'stepTitles',
      label: 'Các bước mặc định',
      width: 'full',
      rows: 6,
      placeholder: 'Mỗi dòng là một bước công việc',
    },
  ],
};

export default spec;
