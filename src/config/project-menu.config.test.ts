import { describe, expect, it } from 'vitest';
import {
  PROJECT_ENTITY_ORDER,
  PROJECT_MENU_GROUPS,
} from './project-menu.config';

describe('PROJECT_MENU_GROUPS', () => {
  it('keeps business domains separated in the sidebar', () => {
    expect(PROJECT_MENU_GROUPS.map((group) => group.title)).toEqual([
      'Không gian làm việc',
      'Kinh doanh',
      'Tài chính',
      'Báo cáo & phân tích',
      'Quản trị tổ chức',
      'Hệ thống',
    ]);
    expect(
      PROJECT_MENU_GROUPS.find(
        (group) => group.title === 'Kinh doanh',
      )?.items.map((item) => item.label),
    ).toEqual(['Khách hàng', 'Hợp đồng', 'Mẫu hợp đồng']);
    expect(
      PROJECT_MENU_GROUPS.find(
        (group) => group.title === 'Tài chính',
      )?.items.map((item) => item.label),
    ).toEqual(['Sổ thu chi', 'Công nợ', 'Quỹ & Tài khoản']);
    expect(
      PROJECT_MENU_GROUPS.find(
        (group) => group.title === 'Báo cáo & phân tích',
      )?.items.map((item) => item.label),
    ).toEqual(['Báo cáo']);
    expect(
      PROJECT_MENU_GROUPS.find(
        (group) => group.title === 'Quản trị tổ chức',
      )?.items.map((item) => item.label),
    ).toEqual([
      'Nhân viên',
      'Tệp lưu trữ',
      'Phân quyền',
      'Cấu hình dữ liệu',
      'Danh mục',
    ]);
    expect(PROJECT_ENTITY_ORDER).toEqual(['customer', 'contract', 'employee']);
  });
});
