import type { DetailSpec } from '@/builders/detail';

const spec = {
  componentName: 'HandoverDetailLayout',
  tabs: [
    { value: 'items', label: 'Danh sách vật tư', icon: 'Boxes' },
    { value: 'history', label: 'Diễn biến', icon: 'History' },
  ],
} satisfies DetailSpec;

export default spec;
