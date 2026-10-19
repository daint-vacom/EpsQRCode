import { ROUTES } from '@/constants/routes';
import { CUSTODIAN_PERMISSION_CODES } from '@/project/custodians/model/custodian-permissions';
import { HANDOVER_PERMISSION_CODES } from '@/project/handover/model/handover-permissions';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import { useTheme } from 'next-themes';
import { useIntl } from 'react-intl';
import { useLocation } from 'react-router-dom';
import { PROJECT_MENU_GROUPS } from '@/config/project-menu.config';
import { useAppSettings } from '@/providers/app-settings-provider';
import { useUser } from '@/providers/user-provider';
import { MainLayout } from '@/components/layouts/main-layout';

const OPERATION_MENU_ACCESS: Record<
  string,
  { permission: string; messageId: string }
> = {
  [ROUTES.PROJECT.MATERIALS]: {
    permission: MATERIAL_PERMISSION_CODES.view,
    messageId: 'project.navigation.materials',
  },
  [ROUTES.PROJECT.HANDOVERS]: {
    permission: HANDOVER_PERMISSION_CODES.view,
    messageId: 'project.navigation.handovers',
  },
  [ROUTES.PROJECT.CUSTODIANS]: {
    permission: CUSTODIAN_PERMISSION_CODES.view,
    messageId: 'project.navigation.custodians',
  },
};

export function ProjectMainLayout() {
  const { hasPermission } = useUser();
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
    items: group.items
      .filter((item) => {
        const requirement = item.path
          ? OPERATION_MENU_ACCESS[item.path]
          : undefined;
        return !requirement || hasPermission(requirement.permission);
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
          : item;
      }),
  })).filter((group) => group.items.length > 0);
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
