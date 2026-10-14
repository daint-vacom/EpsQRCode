import { ROUTES } from '@/constants/routes';
import { useTheme } from 'next-themes';
import { useLocation } from 'react-router-dom';
import { PROJECT_MENU_GROUPS } from '@/config/project-menu.config';
import { useAppSettings } from '@/providers/app-settings-provider';
import { MainLayout } from '@/components/layouts/main-layout';

export function ProjectMainLayout() {
  const { pathname } = useLocation();
  const { appearance } = useAppSettings();
  const { resolvedTheme } = useTheme();
  const sidebarTheme =
    appearance.sidebarTheme === 'theme'
      ? resolvedTheme === 'dark'
        ? 'dark'
        : 'light'
      : appearance.sidebarTheme;
  const menuItems = PROJECT_MENU_GROUPS.flatMap((group) => group.items);
  const activeItem = menuItems.find((item) => item.path === pathname);
  const breadcrumbCurrent = activeItem?.label ?? 'Quản lý vật tư';

  return (
    <>
      <MainLayout
        shell={{
          menuGroups: PROJECT_MENU_GROUPS,
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
