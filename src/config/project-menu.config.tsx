import { ROUTES } from '@/constants/routes';
import {
  CircleDollarSign,
  ClipboardList,
  FileText,
  FolderOpen,
  Landmark,
  Layers3,
  LayoutDashboard,
  ListTree,
  Settings,
  ShieldCheck,
  Tags,
  UserRoundSearch,
  Users,
  WalletCards,
} from 'lucide-react';
import type { MenuGroupConfig } from './menu.types';

/** Menu riêng của project thật. Các menu nghiệp vụ sẽ được bổ sung dần tại đây. */
export const PROJECT_MENU_GROUPS: MenuGroupConfig[] = [
  {
    title: 'Không gian làm việc',
    items: [
      {
        label: 'Tổng quan',
        icon: LayoutDashboard,
        path: '/',
      },
      {
        label: 'Việc của tôi',
        icon: ClipboardList,
        path: ROUTES.PROJECT.MY_WORK,
      },
    ],
  },
  {
    title: 'Kinh doanh',
    items: [
      {
        label: 'Khách hàng',
        icon: UserRoundSearch,
        path: ROUTES.PROJECT.CUSTOMERS,
      },
      {
        label: 'Hợp đồng',
        icon: FileText,
        path: ROUTES.PROJECT.CONTRACTS,
      },
      {
        label: 'Công việc',
        icon: ClipboardList,
        path: ROUTES.PROJECT.WORK,
      },
    ],
  },
  {
    title: 'Tài chính',
    items: [
      {
        label: 'Sổ thu chi',
        icon: WalletCards,
        path: ROUTES.PROJECT.FINANCE_VOUCHERS,
      },
      {
        label: 'Công nợ',
        icon: CircleDollarSign,
        path: ROUTES.PROJECT.FINANCE_OBLIGATIONS,
      },
      {
        label: 'Quỹ & Tài khoản',
        icon: Landmark,
        path: ROUTES.PROJECT.FINANCE_ACCOUNTS,
      },
    ],
  },
  {
    title: 'Báo cáo & phân tích',
    items: [
      {
        label: 'Báo cáo',
        icon: FileText,
        path: ROUTES.PROJECT.REPORTS,
      },
    ],
  },
  {
    title: 'Quản trị tổ chức',
    items: [
      {
        label: 'Nhân viên',
        icon: Users,
        path: ROUTES.PROJECT.EMPLOYEES,
      },
      {
        label: 'Tệp lưu trữ',
        icon: FolderOpen,
        path: ROUTES.PROJECT.FILES,
      },
      {
        label: 'Phân quyền',
        icon: ShieldCheck,
        path: ROUTES.PROJECT.ROLE_PERMISSIONS,
      },
      {
        label: 'Cấu hình dữ liệu',
        icon: ListTree,
        path: ROUTES.PROJECT.DATA_CONFIGURATION,
      },
      {
        label: 'Danh mục',
        icon: Tags,
        path: ROUTES.PROJECT.TAGS,
      },
      {
        label: 'Mẫu hợp đồng',
        icon: Layers3,
        path: ROUTES.PROJECT.CONTRACT_TEMPLATES,
      },
      {
        label: 'Mẫu công việc',
        icon: ListTree,
        path: ROUTES.PROJECT.WORK_TEMPLATES,
      },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      {
        label: 'Cài đặt',
        icon: Settings,
        path: ROUTES.PROJECT.SETTINGS,
      },
    ],
  },
];

export type ProjectEntity = 'customer' | 'contract' | 'work' | 'employee';

const PROJECT_ENTITY_BY_MENU_PATH: Readonly<Record<string, ProjectEntity>> = {
  [ROUTES.PROJECT.CUSTOMERS]: 'customer',
  [ROUTES.PROJECT.CONTRACTS]: 'contract',
  [ROUTES.PROJECT.WORK]: 'work',
  [ROUTES.PROJECT.EMPLOYEES]: 'employee',
};

/** Thứ tự các nhóm đối tượng công việc lấy từ menu sidebar thực tế. */
export const PROJECT_TAG_GROUP_ENTITY_ORDER = PROJECT_MENU_GROUPS.flatMap(
  (group) => group.items.map((item) => PROJECT_ENTITY_BY_MENU_PATH[item.path]),
).filter((entity): entity is ProjectEntity => Boolean(entity));

/** Thứ tự đối tượng đang hỗ trợ trường dữ liệu tùy chỉnh. */
export const PROJECT_ENTITY_ORDER = PROJECT_TAG_GROUP_ENTITY_ORDER.filter(
  (entity): entity is Exclude<ProjectEntity, 'work'> => entity !== 'work',
);
