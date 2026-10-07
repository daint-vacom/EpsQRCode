import { useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { Users } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { PROJECT_MENU_GROUPS } from '@/config/project-menu.config';
import { useAppSettings } from '@/providers/app-settings-provider';
import { useTenant } from '@/providers/tenant-provider';
import { MainLayout } from '@/components/layouts/main-layout';
import { EmployeeCreateDialog } from '../employees/components/employee-create-dialog';

export function ProjectMainLayout() {
  const { pathname } = useLocation();
  const [employeeCreateOpen, setEmployeeCreateOpen] = useState(false);
  const { tenantName, accountRoles } = useTenant();
  const { appearance } = useAppSettings();
  const menuItems = PROJECT_MENU_GROUPS.flatMap((group) => group.items);
  const activeItem = menuItems.find((item) => item.path === pathname);
  const breadcrumbCurrent = activeItem?.label ?? 'Quản lý vật tư';

  return (
    <>
      <MainLayout
        shell={{
          menuGroups: PROJECT_MENU_GROUPS,
          homePath: ROUTES.HOME,
          brandName: 'Quản lý vật tư',
          sidebarBrand: { name: 'VẬT TƯ', subtitle: 'QUẢN LÝ KHO' },
          organizationLabel: tenantName ?? 'Đang tải tổ chức...',
          headerTitle: tenantName ?? 'Đang tải tổ chức...',
          accountRoles,
          secondarySidebarVariant: appearance.sidebarTheme,
          headerVariant: appearance.sidebarTheme,
          quickCreateItems: [
            {
              id: 'employee',
              label: 'Thêm nhân viên',
              icon: Users,
              onSelect: () => setEmployeeCreateOpen(true),
            },
          ],
          breadcrumbRootLabel: 'Tổng quan',
          breadcrumbRootPath: ROUTES.HOME,
          breadcrumbCurrent:
            pathname === ROUTES.HOME ? 'Tổng quan' : breadcrumbCurrent,
        }}
      />
      <EmployeeCreateDialog
        open={employeeCreateOpen}
        onOpenChange={setEmployeeCreateOpen}
      />
    </>
  );
}
