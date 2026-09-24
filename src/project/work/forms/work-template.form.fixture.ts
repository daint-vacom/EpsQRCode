import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'WorkTemplate',
  schemaImport: '../model/work',
  schemaName: 'workTemplateFormSchema',
  valuesType: 'WorkTemplateFormValues',
  title: 'Thêm mẫu công việc',
  description: 'Lưu sẵn thông tin công việc, công việc con và tệp dùng lại.',
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
      kind: 'select',
      name: 'priority',
      label: 'Mức độ ưu tiên',
      width: 'normal',
      optionsFrom: 'prop',
      placeholder: 'Chọn mức độ',
    },
    {
      kind: 'select',
      name: 'assigneeEmployeeId',
      label: 'Nhân viên phụ trách',
      width: 'full',
      optionsFrom: 'prop',
      placeholder: 'Chọn nhân viên',
    },
    {
      kind: 'text',
      name: 'color',
      label: 'Màu công việc',
      width: 'normal',
    },
    {
      kind: 'multiselect',
      name: 'labelIds',
      label: 'Nhãn công việc',
      width: 'full',
      optionsFrom: 'prop',
      searchPlaceholder: 'Tìm nhãn...',
      emptyMessage: 'Không có nhãn phù hợp',
    },
  ],
};

export default spec;
