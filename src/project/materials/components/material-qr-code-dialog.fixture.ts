const spec = {
  componentName: 'MaterialQrCodeDialogShell',
  specPath:
    'src/project/materials/components/material-qr-code-dialog.fixture.ts',
  title: 'Thông tin mã QR vật tư',
  titleMessageId: 'project.materialQrTracking.qrDialog.title',
  width: '2xl',
  actions: [
    {
      name: 'copyLink',
      label: 'Sao chép',
      labelMessageId: 'project.materialQrTracking.qrDialog.actions.copyLink',
      variant: 'outline',
      icon: 'Copy',
    },
    {
      name: 'downloadPng',
      label: 'Tải PNG',
      labelMessageId: 'project.materialQrTracking.qrDialog.actions.downloadPng',
      variant: 'outline',
      icon: 'Download',
    },
    {
      name: 'openLink',
      label: 'Mở trang chi tiết',
      labelMessageId: 'project.materialQrTracking.qrDialog.actions.open',
      variant: 'primary',
      icon: 'ExternalLink',
    },
  ],
} as const;

export default spec;
