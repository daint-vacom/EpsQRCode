import { describe, expect, it } from 'vitest';
import {
  PROJECT_ENTITY_ORDER,
  PROJECT_MENU_GROUPS,
} from './project-menu.config';

describe('PROJECT_MENU_GROUPS', () => {
  it('keeps only shared administration surfaces in the product menu', () => {
    expect(PROJECT_MENU_GROUPS.map((group) => group.title)).toEqual([
      'Quản trị tổ chức',
      'Hệ thống',
    ]);
    expect(PROJECT_MENU_GROUPS[0]?.items.map((item) => item.label)).toEqual([
      'Nhân viên',
      'Nhóm vật tư',
      'Mẫu vật tư',
      'Tệp lưu trữ',
      'Phân quyền',
      'Cấu hình dữ liệu',
      'Danh mục',
    ]);
    expect(PROJECT_MENU_GROUPS[1]?.items.map((item) => item.label)).toEqual([
      'Cài đặt',
    ]);
    expect(PROJECT_ENTITY_ORDER).toEqual(['employee']);
  });
});
