import { ROUTES } from '@/constants/routes';
import {
  FolderOpen,
  ListTree,
  Settings,
  ShieldCheck,
  Tags,
  Users,
} from 'lucide-react';
import type { MenuGroupConfig } from './menu.types';

/** Shared administration surfaces for the materials-management application. */
export const PROJECT_MENU_GROUPS: MenuGroupConfig[] = [
  {
    title: 'Quản trị tổ chức',
    items: [
      {
        label: 'Nhân viên',
        icon: Users,
        path: ROUTES.PROJECT.EMPLOYEES,
      },
      { label: 'Tệp lưu trữ', icon: FolderOpen, path: ROUTES.PROJECT.FILES },
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
      { label: 'Danh mục', icon: Tags, path: ROUTES.PROJECT.TAGS },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { label: 'Cài đặt', icon: Settings, path: ROUTES.PROJECT.SETTINGS },
    ],
  },
];

export type ProjectEntity = 'employee';

const PROJECT_ENTITY_BY_MENU_PATH: Readonly<Record<string, ProjectEntity>> = {
  [ROUTES.PROJECT.EMPLOYEES]: 'employee',
};

/** Entity order follows the project menu and currently contains shared employee data only. */
export const PROJECT_TAG_GROUP_ENTITY_ORDER = PROJECT_MENU_GROUPS.flatMap(
  (group) => group.items.map((item) => PROJECT_ENTITY_BY_MENU_PATH[item.path]),
).filter((entity): entity is ProjectEntity => Boolean(entity));

export const PROJECT_ENTITY_ORDER: ProjectEntity[] = [
  ...PROJECT_TAG_GROUP_ENTITY_ORDER,
];
