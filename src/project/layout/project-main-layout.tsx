import { ROUTES } from '@/constants/routes';
import { HANDOVER_PERMISSION_CODES } from '@/project/handover/model/handover-permissions';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import { MATERIAL_RECEIPT_PERMISSION_CODES } from '@/project/receipts/model/material-receipt';
import { WAREHOUSE_PERMISSION_CODES } from '@/project/warehouses/model/warehouse';
import { useTheme } from 'next-themes';
import { useIntl } from 'react-intl';
import { useLocation } from 'react-router-dom';
import { PROJECT_MENU_GROUPS } from '@/config/project-menu.config';
import { useAppSettings } from '@/providers/app-settings-provider';
import { useUser } from '@/providers/user-provider';
import { MainLayout } from '@/components/layouts/main-layout';
import { useMyPendingDocumentCounts } from './use-my-pending-document-counts';

const OPERATION_MENU_ACCESS: Record<
  string,
  { permission: string; messageId: string }
> = {
  [ROUTES.HOME]: {
    permission: MATERIAL_PERMISSION_CODES.view,
    messageId: 'project.navigation.overview',
  },
  [ROUTES.PROJECT.MATERIALS]: {
    permission: MATERIAL_PERMISSION_CODES.view,
    messageId: 'project.navigation.allMaterials',
  },
  [ROUTES.PROJECT.MATERIAL_QR_TRACKING]: {
    permission: MATERIAL_PERMISSION_CODES.view,
    messageId: 'project.navigation.qrTracking',
  },
  [ROUTES.PROJECT.MATERIAL_LABEL_TEMPLATES]: {
    permission: MATERIAL_PERMISSION_CODES.view,
    messageId: 'project.navigation.materialLabelTemplates',
  },
  [ROUTES.PROJECT.HANDOVERS]: {
    permission: HANDOVER_PERMISSION_CODES.view,
    messageId: 'project.navigation.handovers',
  },
  [ROUTES.PROJECT.WAREHOUSES]: {
    permission: WAREHOUSE_PERMISSION_CODES.view,
    messageId: 'project.navigation.warehouses',
  },
  [ROUTES.PROJECT.RECEIPTS]: {
    permission: MATERIAL_RECEIPT_PERMISSION_CODES.view,
    messageId: 'project.navigation.receipts',
  },
};

export function ProjectMainLayout() {
  const { hasPermission } = useUser();
  const { data: counts } = useMyPendingDocumentCounts();
  const badges: Record<string, number | undefined> = {
    [ROUTES.PROJECT.SAFETY_INSPECTIONS]: counts?.safetyInspections,
    [ROUTES.PROJECT.HANDOVERS]: counts?.handovers,
    [ROUTES.PROJECT.RECEIPTS]: counts?.materialReceipts,
  };
  const intl = useIntl();
  const { pathname } = useLocation();
  const { appearance } = useAppSettings();
  const { resolvedTheme } = useTheme();
  const sidebarTheme =
    appearance.sidebarTheme === 'theme'
      ? resolvedTheme === 'dark'
        ? 'dark'
        : 'light'
      : appearance.sidebarTheme;
  const menuGroups = PROJECT_MENU_GROUPS.map((group) => ({
    ...group,
    title: group.titleMessageId
      ? intl.formatMessage({ id: group.titleMessageId })
      : group.title,
    items: group.items
      .filter((item) => {
        const requirement = item.path
          ? OPERATION_MENU_ACCESS[item.path]
          : undefined;
        if (!requirement) return true;
        if (item.path === ROUTES.PROJECT.RECEIPTS) {
          return (
            hasPermission(requirement.permission) ||
            hasPermission(HANDOVER_PERMISSION_CODES.manage)
          );
        }
        return hasPermission(requirement.permission);
      })
      .map((item) => {
        const requirement = item.path
          ? OPERATION_MENU_ACCESS[item.path]
          : undefined;
        return requirement
          ? {
              ...item,
              label: intl.formatMessage({ id: requirement.messageId }),
            }
          : item.labelMessageId
            ? {
                ...item,
                label: intl.formatMessage({ id: item.labelMessageId }),
              }
            : item;
      }),
  })).filter((group) => group.items.length > 0);
  for (const group of menuGroups) {
    group.items = group.items.map((item) => {
      const count = item.path ? badges[item.path] : undefined;
      return count ? { ...item, badge: count } : item;
    });
  }
  const menuItems = menuGroups.flatMap((group) => group.items);
  const activeItem = menuItems.find((item) => item.path === pathname);
  const breadcrumbCurrent = activeItem?.label ?? 'Quản lý vật tư';

  return (
    <>
      <MainLayout
        shell={{
          menuGroups,
          homePath: ROUTES.HOME,
          brandName: 'Quản Lý Vật Tư QR Code',
          headerTitle: 'Quản Lý Vật Tư QR Code',
          secondarySidebarVariant: sidebarTheme,
          headerVariant: sidebarTheme,
          breadcrumbRootLabel: 'Tổng quan',
          breadcrumbRootPath: ROUTES.HOME,
          breadcrumbCurrent:
            pathname === ROUTES.HOME ? 'Tổng quan' : breadcrumbCurrent,
        }}
      />
    </>
  );
}
