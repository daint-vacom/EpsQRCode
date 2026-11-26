import type { FilterSpec } from '@/builders/filter';

const spec: FilterSpec = {
  componentName: 'HandoverFilterBar',
  fields: [
    {
      type: 'search',
      name: 'search',
      placeholder: 'Tìm mã phiếu hoặc vật tư',
      className: 'w-64',
    },
    {
      type: 'select',
      name: 'type',
      label: 'Loại phiếu',
      options: [
        { value: 'transfer', label: 'Chuyển sở hữu' },
        { value: 'loan', label: 'Cho mượn' },
        { value: 'return', label: 'Trả lại' },
      ],
      className: 'w-44',
    },
    {
      type: 'select',
      name: 'status',
      label: 'Trạng thái',
      options: [
        { value: 'draft', label: 'Bản nháp' },
        { value: 'pending', label: 'Chờ ký xác nhận' },
        { value: 'completed', label: 'Hoàn tất' },
        { value: 'rejected', label: 'Đã từ chối' },
        { value: 'cancelled', label: 'Đã hủy' },
      ],
      className: 'w-44',
    },
  ],
};

export default spec;
