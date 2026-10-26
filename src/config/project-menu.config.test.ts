import { describe, expect, it } from 'vitest';
import {
  PROJECT_ENTITY_ORDER,
  PROJECT_MENU_GROUPS,
} from './project-menu.config';

describe('PROJECT_MENU_GROUPS', () => {
  it('includes material operations and shared administration surfaces', () => {
    expect(PROJECT_MENU_GROUPS.map((group) => group.title)).toEqual([
      'Không gian làm việc',
      'Báo cáo',
      'Quản trị tổ chức',
      'Hệ thống',
    ]);
    expect(PROJECT_MENU_GROUPS[0]?.items.map((item) => item.label)).toEqual([
      'Quản lý vật tư',
      'Phiếu nhập vật tư',
      'Phiếu bàn giao',
    ]);
    expect(PROJECT_MENU_GROUPS[1]?.items.map((item) => item.label)).toEqual([
      'Báo cáo',
    ]);
    expect(PROJECT_MENU_GROUPS[2]?.items.map((item) => item.label)).toEqual([
      'Mẫu vật tư',
      'Nhóm vật tư',
      'Thông số kỹ thuật',
      'Kho',
      'Đơn vị EPS',
      'Đơn vị ngoài',
      'Tệp lưu trữ',
      'Tài khoản đăng nhập',
      'Phân quyền',
    ]);
    expect(PROJECT_MENU_GROUPS[3]?.items.map((item) => item.label)).toEqual([
      'Cài đặt',
    ]);
    expect(
      PROJECT_MENU_GROUPS.flatMap((group) => group.items).some(
        (item) => item.path === '/danh-muc',
      ),
    ).toBe(false);
    expect(PROJECT_ENTITY_ORDER).toEqual(['employee']);
  });
});
