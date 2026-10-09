const spec = {
  componentName: 'CustomFieldOptionsDialogShell',
  specPath:
    'src/project/data-configuration/components/custom-field-options.dialog.fixture.ts',
  title: 'Danh sách giá trị',
  titleProp: 'dialogTitle',
  width: 'lg',
  actions: [
    {
      name: 'cancel',
      label: 'Hủy',
      labelMessageId: 'common.actions.cancel',
      variant: 'outline',
      disabledProp: 'isSaving',
    },
    {
      name: 'save',
      label: 'Lưu danh sách',
      labelMessageId: 'customFields.options.save',
      variant: 'primary',
      icon: 'Save',
      loadingProp: 'isSaving',
      loadingText: 'Đang lưu',
      loadingMessageId: 'customFields.options.saving',
      disabledProp: 'canSave',
      disabledWhen: 'falsy',
    },
  ],
} as const;

export default spec;
