import { describe, expect, it } from 'vitest';
import {
  PROJECT_ENTITY_ORDER,
  PROJECT_MENU_GROUPS,
} from './project-menu.config';

describe('PROJECT_MENU_GROUPS', () => {
  it('includes material operations and shared administration surfaces', () => {
    expect(PROJECT_MENU_GROUPS.map((group) => group.title)).toEqual([
      'Quản lý vật tư',
      'Quản trị tổ chức',
      'Hệ thống',
    ]);
    expect(PROJECT_MENU_GROUPS[0]?.items.map((item) => item.label)).toEqual([
      'Vật tư',
      'Phiếu bàn giao',
      'Mẫu vật tư',
      'Nhóm vật tư',
      'Thông số VT',
    ]);
    expect(PROJECT_MENU_GROUPS[1]?.items.map((item) => item.label)).toEqual([
      'Chủ thể bàn giao',
      'Nhân viên',
      'Tệp lưu trữ',
      'Phân quyền',
      'Danh mục',
    ]);
    expect(PROJECT_MENU_GROUPS[2]?.items.map((item) => item.label)).toEqual([
      'Cài đặt',
    ]);
    expect(PROJECT_ENTITY_ORDER).toEqual(['employee']);
  });
});
