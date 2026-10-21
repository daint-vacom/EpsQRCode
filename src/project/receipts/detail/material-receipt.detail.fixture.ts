import type { DetailSpec } from '@/builders/detail';

const spec = {
  componentName: 'MaterialReceiptDetailLayout',
  tabs: [
    { value: 'details', label: 'Chi tiết phiếu', icon: 'ClipboardList' },
    { value: 'handovers', label: 'Bàn giao vật tư', icon: 'ArrowRightLeft' },
  ],
} satisfies DetailSpec;

export default spec;
