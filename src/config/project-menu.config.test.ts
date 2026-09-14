import { describe, expect, it } from 'vitest';
import {
  PROJECT_ENTITY_ORDER,
  PROJECT_MENU_GROUPS,
} from './project-menu.config';

describe('PROJECT_MENU_GROUPS', () => {
  it('keeps the sidebar and project entity order aligned', () => {
    const adminItems = PROJECT_MENU_GROUPS.find(
      (group) => group.title === 'Quản trị',
    );

    expect(adminItems?.items.map((item) => item.label)).toEqual([
      'Khách hàng',
      'Hợp đồng',
      'Mẫu hợp đồng',
      'Nhân viên',
      'Sổ thu chi',
      'Công nợ',
      'Quỹ & Tài khoản',
      'Báo cáo',
      'Tệp lưu trữ',
      'Phân quyền',
      'Cấu hình dữ liệu',
      'Danh mục',
    ]);
    expect(PROJECT_ENTITY_ORDER).toEqual(['customer', 'contract', 'employee']);
  });
});
