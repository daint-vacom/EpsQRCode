const spec = {
  componentName: 'SafetyInspectionTypeConfigDialog',
  specPath:
    'src/project/material-safety-inspections/components/safety-inspection-type-config-dialog.fixture.ts',
  title: 'Cấu hình loại kiểm tra',
  titleMessageId: 'project.materials.safetyInspection.typeConfig.dialog.title',
  description: 'Cấu hình checklist, chu kỳ và phạm vi áp dụng.',
  descriptionMessageId:
    'project.materials.safetyInspection.typeConfig.dialog.description',
  width: '4xl',
  actions: [
    {
      name: 'cancel',
      label: 'Hủy',
      labelMessageId: 'common.actions.cancel',
      variant: 'outline',
      type: 'button',
    },
    {
      name: 'save',
      label: 'Lưu',
      labelMessageId: 'common.actions.save',
      variant: 'primary',
      type: 'button',
      loadingProp: 'isSaving',
      loadingText: 'Đang lưu',
      loadingMessageId: 'common.state.saving',
    },
  ],
} as const;

export default spec;
