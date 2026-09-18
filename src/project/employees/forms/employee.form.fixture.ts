import type { FormSpec } from '@/builders/form';

const spec: FormSpec = {
  entity: 'Employee',
  schemaImport: '../model/employee',
  schemaName: 'employeeFormSchema',
  valuesType: 'EmployeeFormValues',
  title: 'Thêm nhân viên',
  specPath: 'src/project/employees/forms/employee.form.fixture.ts',
  fields: [
    {
      kind: 'image',
      name: 'imageUrl',
      label: 'Ảnh nhân viên',
      width: 'full',
      accept: 'image/png,image/jpeg,image/webp',
      maxSizeMb: 5,
      fallbackText: 'NV',
    },
    {
      kind: 'text',
      name: 'employeeCode',
      label: 'Mã nhân viên',
      width: 'normal',
      required: true,
    },
    {
      kind: 'text',
      name: 'firstName',
      label: 'Tên',
      width: 'normal',
      required: true,
    },
    { kind: 'text', name: 'lastName', label: 'Họ và tên đệm', width: 'normal' },
    {
      kind: 'text',
      name: 'phone',
      label: 'Số điện thoại',
      width: 'normal',
      inputType: 'tel',
    },
    {
      kind: 'select',
      name: 'status',
      label: 'Trạng thái',
      width: 'normal',
      options: [
        { value: 'active', label: 'Còn làm việc' },
        { value: 'inactive', label: 'Ngừng làm việc' },
      ],
    },
    {
      kind: 'date',
      name: 'joinedAt',
      label: 'Ngày vào làm',
      width: 'normal',
      format: 'display',
    },
    {
      kind: 'textarea',
      name: 'note',
      label: 'Ghi chú',
      width: 'full',
      rows: 3,
    },
    {
      kind: 'switch',
      name: 'createAccount',
      label: 'Tạo tài khoản đăng nhập',
      width: 'full',
    },
    {
      kind: 'text',
      name: 'accountUsername',
      label: 'Tên đăng nhập',
      width: 'normal',
    },
    {
      kind: 'text',
      name: 'initialPassword',
      label: 'Mật khẩu ban đầu',
      width: 'normal',
      inputType: 'password',
    },
  ],
};

export default spec;
