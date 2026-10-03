import type { DialogSpec } from '@/builders/dialog';

const spec = {
  componentName: 'EmployeeCustomerAssignmentDialogShell',
  specPath:
    'src/project/employees/components/employee-customer-assignment.dialog.fixture.ts',
  title: 'Phân công khách hàng',
  titleProp: 'dialogTitle',
  width: 'xl',
  actions: [
    {
      name: 'cancel',
      label: 'Hủy',
      variant: 'outline',
      disabledProp: 'isSaving',
      disabledWhen: 'truthy',
    },
    {
      name: 'confirm',
      label: 'Lưu phân công',
      variant: 'primary',
      icon: 'Check',
      loadingProp: 'isSaving',
      loadingText: 'Đang lưu...',
      disabledProp: 'canConfirm',
      disabledWhen: 'falsy',
    },
  ],
} satisfies DialogSpec;

export default spec;
