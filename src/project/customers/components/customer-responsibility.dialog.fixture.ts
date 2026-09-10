import type { DialogSpec } from '@/builders/dialog';

const spec = {
  componentName: 'CustomerResponsibilityDialogShell',
  specPath:
    'src/project/customers/components/customer-responsibility.dialog.fixture.ts',
  title: 'Phân công nhân viên phụ trách',
  titleProp: 'dialogTitle',
  width: 'xl',
  actions: [
    {
      name: 'cancel',
      label: 'Hủy',
      variant: 'outline',
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
