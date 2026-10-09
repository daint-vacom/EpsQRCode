const spec = {
  componentName: 'FileRenameDialogShell',
  specPath: 'src/project/files/components/file-rename.dialog.fixture.ts',
  title: 'Đổi tên mục',
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
      label: 'Lưu thay đổi',
      variant: 'primary',
      icon: 'Check',
      loadingProp: 'isSaving',
      loadingText: 'Đang lưu',
      disabledProp: 'canConfirm',
      disabledWhen: 'falsy',
    },
  ],
} as const;

export default spec;
