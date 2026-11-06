import { describe, expect, it } from 'vitest';
import {
  PROJECT_ENTITY_ORDER,
  PROJECT_MENU_GROUPS,
} from './project-menu.config';

describe('PROJECT_MENU_GROUPS', () => {
  it('includes material operations and shared administration surfaces', () => {
    expect(PROJECT_MENU_GROUPS.map((group) => group.title)).toEqual([
      'Quản lý vật tư',
      'Quản lý phiếu',
      'Báo cáo',
      'Quản trị tổ chức',
      'Hệ thống',
    ]);
    expect(PROJECT_MENU_GROUPS[0]?.items.map((item) => item.label)).toEqual([
      'Tất cả vật tư',
      'Theo dõi mã QR',
      'Vật tư cần kiểm định',
    ]);
    expect(PROJECT_MENU_GROUPS[1]?.items.map((item) => item.label)).toEqual([
      'Bàn giao vật tư',
      'Nhập vật tư',
    ]);
    expect(PROJECT_MENU_GROUPS[2]?.items.map((item) => item.label)).toEqual([
      'Báo cáo',
    ]);
    expect(PROJECT_MENU_GROUPS[3]?.items.map((item) => item.label)).toEqual([
      'Nhóm vật tư',
      'Mẫu vật tư',
      'Mẫu tem nhãn QR',
      'Thông số kỹ thuật',
      'Đơn vị EPS',
      'Đơn vị ngoài',
      'Kho',
      'Tệp lưu trữ',
      'Tài khoản',
      'Phân quyền',
    ]);
    expect(PROJECT_MENU_GROUPS[4]?.items.map((item) => item.label)).toEqual([
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
