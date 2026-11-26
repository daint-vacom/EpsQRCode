import { ROUTES } from '@/constants/routes';
import type { MenuGroupConfig } from './menu.types';
import { PROJECT_FEATURE_ICONS } from './project-feature-icons';

/** Shared administration surfaces for the materials-management application. */
export const PROJECT_MENU_GROUPS: MenuGroupConfig[] = [
  {
    title: 'Báo cáo',
    titleMessageId: 'project.navigation.groups.reports',
    items: [
      {
        label: 'Tổng quan',
        labelMessageId: 'project.navigation.overview',
        icon: PROJECT_FEATURE_ICONS.overview,
        path: ROUTES.HOME,
      },
      {
        label: 'Báo cáo',
        labelMessageId: 'project.navigation.reports',
        icon: PROJECT_FEATURE_ICONS.reports,
        path: ROUTES.PROJECT.REPORTS,
      },
    ],
  },
  {
    title: 'Quản lý vật tư',
    titleMessageId: 'project.navigation.groups.materialManagement',
    items: [
      {
        label: 'Tất cả vật tư',
        labelMessageId: 'project.navigation.allMaterials',
        icon: PROJECT_FEATURE_ICONS.materials,
        path: ROUTES.PROJECT.MATERIALS,
      },
      {
        label: 'Theo dõi mã QR',
        labelMessageId: 'project.navigation.qrTracking',
        icon: PROJECT_FEATURE_ICONS.materialQrTracking,
        path: ROUTES.PROJECT.MATERIAL_QR_TRACKING,
      },
      {
        label: 'Vật tư cần kiểm tra',
        labelMessageId: 'project.navigation.materialsRequiringInspection',
        icon: PROJECT_FEATURE_ICONS.materialsRequiringInspection,
        path: ROUTES.PROJECT.MATERIALS_REQUIRING_INSPECTION,
      },
      {
        label: 'Vật tư kho',
        labelMessageId: 'project.navigation.warehouseStock',
        icon: PROJECT_FEATURE_ICONS.warehouseStock,
        path: ROUTES.PROJECT.WAREHOUSE_STOCK,
      },
    ],
  },
  {
    title: 'Quản lý phiếu',
    titleMessageId: 'project.navigation.groups.slips',
    items: [
      {
        label: 'Phiếu kiểm tra an toàn',
        labelMessageId: 'project.navigation.safetyInspections',
        icon: PROJECT_FEATURE_ICONS.safetyInspections,
        path: ROUTES.PROJECT.SAFETY_INSPECTIONS,
      },
      {
        label: 'Bàn giao vật tư',
        labelMessageId: 'project.navigation.handovers',
        icon: PROJECT_FEATURE_ICONS.handovers,
        path: ROUTES.PROJECT.HANDOVERS,
      },
      {
        label: 'Nhập vật tư',
        labelMessageId: 'project.navigation.receipts',
        icon: PROJECT_FEATURE_ICONS.receipts,
        path: ROUTES.PROJECT.RECEIPTS,
      },
    ],
  },
  {
    title: 'Quản trị tổ chức',
    titleMessageId: 'project.navigation.groups.organization',
    items: [
      {
        label: 'Nhóm vật tư',
        labelMessageId: 'project.navigation.materialGroups',
        icon: PROJECT_FEATURE_ICONS.materialGroups,
        path: ROUTES.PROJECT.MATERIAL_GROUPS,
      },
      {
        label: 'Mẫu vật tư',
        labelMessageId: 'project.navigation.materialModels',
        icon: PROJECT_FEATURE_ICONS.materialModels,
        path: ROUTES.PROJECT.MATERIAL_MODELS,
      },
      {
        label: 'Mẫu tem nhãn QR',
        labelMessageId: 'project.navigation.materialLabelTemplates',
        icon: PROJECT_FEATURE_ICONS.materialLabelTemplates,
        path: ROUTES.PROJECT.MATERIAL_LABEL_TEMPLATES,
      },
      {
        label: 'Thông số kỹ thuật',
        labelMessageId: 'project.navigation.materialSpecifications',
        icon: PROJECT_FEATURE_ICONS.materialSpecifications,
        path: ROUTES.PROJECT.MATERIAL_SPECIFICATIONS,
      },
      {
        label: 'Đơn vị EPS',
        labelMessageId: 'project.navigation.epsOrganizations',
        icon: PROJECT_FEATURE_ICONS.epsOrganizations,
        path: ROUTES.PROJECT.EPS_ORGANIZATIONS,
      },
      {
        label: 'Đơn vị ngoài',
        labelMessageId: 'project.navigation.externalOrganizations',
        icon: PROJECT_FEATURE_ICONS.externalOrganizations,
        path: ROUTES.PROJECT.EXTERNAL_ORGANIZATIONS,
      },
      {
        label: 'Kho',
        labelMessageId: 'project.navigation.warehouses',
        icon: PROJECT_FEATURE_ICONS.warehouses,
        path: ROUTES.PROJECT.WAREHOUSES,
      },
      {
        label: 'Tệp lưu trữ',
        labelMessageId: 'project.navigation.files',
        icon: PROJECT_FEATURE_ICONS.files,
        path: ROUTES.PROJECT.FILES,
      },
      {
        label: 'Tài khoản',
        labelMessageId: 'project.navigation.accounts',
        icon: PROJECT_FEATURE_ICONS.accounts,
        path: ROUTES.PROJECT.ACCOUNTS,
      },
      {
        label: 'Phân quyền',
        labelMessageId: 'project.navigation.rolePermissions',
        icon: PROJECT_FEATURE_ICONS.rolePermissions,
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
        icon: PROJECT_FEATURE_ICONS.settings,
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
