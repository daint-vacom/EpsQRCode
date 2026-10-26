import { ROUTES } from '@/constants/routes';
import {
  ArrowRightLeft,
  Boxes,
  Building2,
  ClipboardPlus,
  Folder,
  FolderOpen,
  Package,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Users,
} from 'lucide-react';
import type { MenuGroupConfig } from './menu.types';

/** Shared administration surfaces for the materials-management application. */
export const PROJECT_MENU_GROUPS: MenuGroupConfig[] = [
  {
    title: 'Quản lý vật tư',
    items: [
      {
        label: 'Vật tư',
        icon: Package,
        path: ROUTES.PROJECT.MATERIALS,
      },
      {
        label: 'Phiếu bàn giao',
        icon: ArrowRightLeft,
        path: ROUTES.PROJECT.HANDOVERS,
      },
      {
        label: 'Kho',
        icon: Building2,
        path: ROUTES.PROJECT.WAREHOUSES,
      },
      {
        label: 'Phiếu nhập vật tư',
        icon: ClipboardPlus,
        path: ROUTES.PROJECT.RECEIPTS,
      },
      {
        label: 'Mẫu vật tư',
        icon: Boxes,
        path: ROUTES.PROJECT.MATERIAL_MODELS,
      },
      {
        label: 'Nhóm vật tư',
        icon: Folder,
        path: ROUTES.PROJECT.MATERIAL_GROUPS,
      },
      {
        label: 'Thông số VT',
        icon: SlidersHorizontal,
        path: ROUTES.PROJECT.MATERIAL_SPECIFICATIONS,
      },
    ],
  },
  {
    title: 'Quản trị tổ chức',
    items: [
      {
        label: 'Đơn vị EPS',
        icon: Building2,
        path: ROUTES.PROJECT.EPS_ORGANIZATIONS,
      },
      {
        label: 'Tài khoản đăng nhập',
        icon: Users,
        path: ROUTES.PROJECT.ACCOUNTS,
      },
      {
        label: 'Đơn vị ngoài',
        icon: Building2,
        path: ROUTES.PROJECT.EXTERNAL_ORGANIZATIONS,
      },
      { label: 'Tệp lưu trữ', icon: FolderOpen, path: ROUTES.PROJECT.FILES },
      {
        label: 'Phân quyền',
        icon: ShieldCheck,
        path: ROUTES.PROJECT.ROLE_PERMISSIONS,
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
  [ROUTES.PROJECT.ACCOUNTS]: 'employee',
};

/** Entity order follows the project menu and currently contains shared employee data only. */
export const PROJECT_TAG_GROUP_ENTITY_ORDER = PROJECT_MENU_GROUPS.flatMap(
  (group) => group.items.map((item) => PROJECT_ENTITY_BY_MENU_PATH[item.path]),
).filter((entity): entity is ProjectEntity => Boolean(entity));

export const PROJECT_ENTITY_ORDER: ProjectEntity[] = [
  ...PROJECT_TAG_GROUP_ENTITY_ORDER,
];
