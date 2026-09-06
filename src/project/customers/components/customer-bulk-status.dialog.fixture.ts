const spec = {
  componentName: 'CustomerBulkStatusDialogShell',
  specPath:
    'src/project/customers/components/customer-bulk-status.dialog.fixture.ts',
  title: 'Cập nhật trạng thái khách hàng',
  titleProp: 'dialogTitle',
  width: 'sm',
  actions: [
    {
      name: 'cancel',
      label: 'Hủy',
      variant: 'outline',
      disabledProp: 'isSaving',
    },
    {
      name: 'confirm',
      label: 'Cập nhật trạng thái',
      variant: 'primary',
      icon: 'Check',
      loadingProp: 'isSaving',
      loadingText: 'Đang cập nhật...',
      disabledProp: 'canConfirm',
      disabledWhen: 'falsy',
    },
  ],
} as const;

export default spec;
