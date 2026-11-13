import type { DetailSpec } from '@/builders/detail';

const spec = {
  componentName: 'MaterialReceiptDetailLayout',
  tabs: [
    { value: 'items', label: 'Danh sách vật tư', icon: 'Boxes' },
    { value: 'allocation', label: 'Phân bổ vật tư', icon: 'ArrowRightLeft' },
  ],
} satisfies DetailSpec;

export default spec;
