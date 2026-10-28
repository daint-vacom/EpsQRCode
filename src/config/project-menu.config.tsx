import { ROUTES } from '@/constants/routes';
import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  Building2,
  ClipboardPlus,
  Folder,
  FolderOpen,
  Package,
  QrCode,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import type { MenuGroupConfig } from './menu.types';

/** Shared administration surfaces for the materials-management application. */
export const PROJECT_MENU_GROUPS: MenuGroupConfig[] = [
  {
    title: 'Không gian làm việc',
    titleMessageId: 'project.navigation.groups.workspace',
    items: [
      {
        label: 'Quản lý vật tư',
        labelMessageId: 'project.navigation.materials',
        icon: Package,
        path: ROUTES.PROJECT.MATERIALS,
      },
      {
        label: 'Phiếu nhập vật tư',
        labelMessageId: 'project.navigation.receipts',
        icon: ClipboardPlus,
        path: ROUTES.PROJECT.RECEIPTS,
      },
      {
        label: 'Phiếu bàn giao',
        labelMessageId: 'project.navigation.handovers',
        icon: ArrowRightLeft,
        path: ROUTES.PROJECT.HANDOVERS,
      },
    ],
  },
  {
    title: 'Báo cáo',
    titleMessageId: 'project.navigation.groups.reports',
    items: [
      {
        label: 'Báo cáo',
        labelMessageId: 'project.navigation.reports',
        icon: BarChart3,
        path: ROUTES.PROJECT.REPORTS,
      },
    ],
  },
  {
    title: 'Quản trị tổ chức',
    titleMessageId: 'project.navigation.groups.organization',
    items: [
      {
        label: 'Mẫu vật tư',
        labelMessageId: 'project.navigation.materialModels',
        icon: Boxes,
        path: ROUTES.PROJECT.MATERIAL_MODELS,
      },
      {
        label: 'Mẫu tem nhãn QR',
        labelMessageId: 'project.navigation.materialLabelTemplates',
        icon: QrCode,
        path: ROUTES.PROJECT.MATERIAL_LABEL_TEMPLATES,
      },
      {
        label: 'Nhóm vật tư',
        labelMessageId: 'project.navigation.materialGroups',
        icon: Folder,
        path: ROUTES.PROJECT.MATERIAL_GROUPS,
      },
      {
        label: 'Thông số kỹ thuật',
        labelMessageId: 'project.navigation.materialSpecifications',
        icon: SlidersHorizontal,
        path: ROUTES.PROJECT.MATERIAL_SPECIFICATIONS,
      },
      {
        label: 'Kho',
        labelMessageId: 'project.navigation.warehouses',
        icon: Building2,
        path: ROUTES.PROJECT.WAREHOUSES,
      },
      {
        label: 'Đơn vị EPS',
        labelMessageId: 'project.navigation.epsOrganizations',
        icon: Building2,
        path: ROUTES.PROJECT.EPS_ORGANIZATIONS,
      },
      {
        label: 'Đơn vị ngoài',
        labelMessageId: 'project.navigation.externalOrganizations',
        icon: Building2,
        path: ROUTES.PROJECT.EXTERNAL_ORGANIZATIONS,
      },
      {
        label: 'Tệp lưu trữ',
        labelMessageId: 'project.navigation.files',
        icon: FolderOpen,
        path: ROUTES.PROJECT.FILES,
      },
      {
        label: 'Tài khoản đăng nhập',
        labelMessageId: 'project.navigation.accounts',
        icon: Users,
        path: ROUTES.PROJECT.ACCOUNTS,
      },
      {
        label: 'Phân quyền',
        labelMessageId: 'project.navigation.rolePermissions',
        icon: ShieldCheck,
        path: ROUTES.PROJECT.ROLE_PERMISSIONS,
      },
    ],
  },
  {
    title: 'Hệ thống',
    titleMessageId: 'project.navigation.groups.system',
    items: [
      {
        label: 'Cài đặt',
        labelMessageId: 'project.navigation.settings',
        icon: Settings,
        path: ROUTES.PROJECT.SETTINGS,
      },
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
