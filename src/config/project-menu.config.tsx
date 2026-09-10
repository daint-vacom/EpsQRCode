import { ROUTES } from '@/constants/routes';
import {
  FileText,
  FolderOpen,
  Layers3,
  LayoutDashboard,
  ListTree,
  Settings,
  ShieldCheck,
  Tags,
  UserRoundSearch,
  Users,
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
    ],
  },
  {
    title: 'Quản trị',
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
        label: 'Mẫu hợp đồng',
        icon: Layers3,
        path: ROUTES.PROJECT.CONTRACT_TEMPLATES,
      },
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
        label: 'Nhãn',
        icon: Tags,
        path: ROUTES.PROJECT.TAGS,
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

export type ProjectEntity = 'customer' | 'contract' | 'employee';

const PROJECT_ENTITY_BY_MENU_PATH: Readonly<Record<string, ProjectEntity>> = {
  [ROUTES.PROJECT.CUSTOMERS]: 'customer',
  [ROUTES.PROJECT.CONTRACTS]: 'contract',
  [ROUTES.PROJECT.EMPLOYEES]: 'employee',
};

/** Thứ tự các đối tượng nghiệp vụ được lấy từ menu sidebar thực tế. */
export const PROJECT_ENTITY_ORDER = PROJECT_MENU_GROUPS.flatMap((group) =>
  group.items.map((item) => PROJECT_ENTITY_BY_MENU_PATH[item.path]),
).filter((entity): entity is ProjectEntity => Boolean(entity));
