import { useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PROJECT_MENU_GROUPS } from '@/config/project-menu.config';
import { useAppSettings } from '@/providers/app-settings-provider';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { MainLayout } from '@/components/layouts/main-layout';
import { loadContractDetail } from '../contracts/api/contracts.api';
import { loadCustomerDetail } from '../customers/api/customers.api';
import { CustomerCreateDialog } from '../customers/components/customer-create-dialog';
import { EmployeeCreateDialog } from '../employees/components/employee-create-dialog';

function getProjectMenuIcon(path: string) {
  const menuItem = PROJECT_MENU_GROUPS.flatMap((group) => group.items).find(
    (item) => item.path === path,
  );

  if (!menuItem) {
    throw new Error(`Không tìm thấy icon menu cho route: ${path}`);
  }

  return menuItem.icon;
}

export function ProjectMainLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [employeeCreateOpen, setEmployeeCreateOpen] = useState(false);
  const { userId } = useUser();
  const { tenantId, tenantName, roleNames } = useTenant();
  const { appearance } = useAppSettings();
  const isContractCreate = pathname === ROUTES.PROJECT.CONTRACT_CREATE;
  const contractEditId = isContractCreate
    ? searchParams.get('edit')
    : undefined;
  const isContractEdit = Boolean(contractEditId);
  const isCustomerDetail = pathname.startsWith(`${ROUTES.PROJECT.CUSTOMERS}/`);
  const isContractDetail =
    pathname.startsWith(`${ROUTES.PROJECT.CONTRACTS}/`) && !isContractCreate;
  const isContractTemplateCreate =
    pathname === ROUTES.PROJECT.CONTRACT_TEMPLATE_CREATE;
  const isContractTemplateEdit =
    pathname.startsWith(`${ROUTES.PROJECT.CONTRACT_TEMPLATES}/`) &&
    pathname.endsWith('/edit');
  const isContractTemplateDetail =
    pathname.startsWith(`${ROUTES.PROJECT.CONTRACT_TEMPLATES}/`) &&
    !isContractTemplateCreate &&
    !isContractTemplateEdit;
  const customerId = isCustomerDetail
    ? pathname.slice(`${ROUTES.PROJECT.CUSTOMERS}/`.length).split('/')[0]
    : undefined;
  const contractId = isContractDetail
    ? pathname.slice(`${ROUTES.PROJECT.CONTRACTS}/`.length).split('/')[0]
    : contractEditId;
  const customerDetailQuery = useQuery({
    queryKey: ['project', 'customers', 'detail', userId, customerId, tenantId],
    queryFn: () => {
      if (!userId || !customerId || !tenantId)
        throw new Error('Thiếu thông tin khách hàng.');
      return loadCustomerDetail(userId, customerId, tenantId);
    },
    enabled: Boolean(userId && customerId && tenantId),
  });
  const contractDetailQuery = useQuery({
    queryKey: ['project', 'contracts', 'detail', userId, contractId, tenantId],
    queryFn: () => {
      if (!userId || !contractId || !tenantId) {
        throw new Error('Thiếu thông tin hợp đồng.');
      }
      return loadContractDetail(userId, contractId, tenantId);
    },
    enabled: Boolean(userId && contractId && tenantId),
  });

  const headerTenantName = tenantName ?? 'Đang tải tenant...';
  const accountRoles = roleNames;
  const breadcrumbCurrent = isCustomerDetail
    ? (customerDetailQuery.data?.name ?? 'Chi tiết khách hàng')
    : isContractDetail
      ? (contractDetailQuery.data?.name ?? 'Chi tiết hợp đồng')
      : isContractTemplateCreate
        ? 'Thêm mẫu hợp đồng'
        : isContractTemplateEdit
          ? 'Chỉnh sửa mẫu hợp đồng'
          : isContractTemplateDetail
            ? 'Chi tiết mẫu hợp đồng'
            : isContractEdit
              ? 'Chỉnh sửa'
              : isContractCreate
                ? 'Thêm hợp đồng'
                : pathname === ROUTES.PROJECT.EMPLOYEES
                  ? 'Nhân viên'
                  : pathname === ROUTES.PROJECT.CUSTOMERS
                    ? 'Khách hàng'
                    : pathname === ROUTES.PROJECT.SETTINGS
                      ? 'Cài đặt'
                      : pathname === ROUTES.PROJECT.ROLE_PERMISSIONS
                        ? 'Phân quyền'
                        : pathname === ROUTES.PROJECT.DATA_CONFIGURATION
                          ? 'Cấu hình dữ liệu'
                          : pathname === ROUTES.PROJECT.TAGS
                            ? 'Nhãn'
                            : 'Tổng quan';

  const quickCreateItems = [
    {
      id: 'customer',
      label: 'Thêm khách hàng',
      icon: getProjectMenuIcon(ROUTES.PROJECT.CUSTOMERS),
      onSelect: () => setCustomerCreateOpen(true),
    },
    {
      id: 'contract',
      label: 'Thêm hợp đồng',
      icon: getProjectMenuIcon(ROUTES.PROJECT.CONTRACTS),
      onSelect: () => navigate(ROUTES.PROJECT.CONTRACT_CREATE),
    },
    {
      id: 'contract-template',
      label: 'Thêm mẫu hợp đồng',
      icon: getProjectMenuIcon(ROUTES.PROJECT.CONTRACT_TEMPLATES),
      onSelect: () => navigate(ROUTES.PROJECT.CONTRACT_TEMPLATE_CREATE),
    },
    {
      id: 'employee',
      label: 'Thêm nhân viên',
      icon: getProjectMenuIcon(ROUTES.PROJECT.EMPLOYEES),
      onSelect: () => setEmployeeCreateOpen(true),
    },
  ];

  return (
    <>
      <MainLayout
        shell={{
          menuGroups: PROJECT_MENU_GROUPS,
          homePath: '/',
          brandName: 'VACOM | KẾ TOÁN DỊCH VỤ',
          headerTitle: headerTenantName,
          accountRoles,
          secondarySidebarVariant: appearance.sidebarTheme,
          headerVariant: appearance.sidebarTheme,
          quickCreateItems,
          breadcrumbRootLabel: 'Trang chủ',
          breadcrumbRootPath: '/',
          breadcrumbCurrent,
          ...(isCustomerDetail
            ? {
                breadcrumbItems: [
                  { label: 'Trang chủ', path: '/' },
                  { label: 'Khách hàng', path: ROUTES.PROJECT.CUSTOMERS },
                  { label: breadcrumbCurrent },
                ],
              }
            : isContractDetail
              ? {
                  breadcrumbItems: [
                    { label: 'Trang chủ', path: '/' },
                    { label: 'Hợp đồng', path: ROUTES.PROJECT.CONTRACTS },
                    { label: breadcrumbCurrent },
                  ],
                }
              : isContractTemplateDetail ||
                  isContractTemplateEdit ||
                  isContractTemplateCreate
                ? {
                    breadcrumbItems: [
                      { label: 'Trang chủ', path: '/' },
                      {
                        label: 'Mẫu hợp đồng',
                        path: ROUTES.PROJECT.CONTRACT_TEMPLATES,
                      },
                      ...(isContractTemplateDetail
                        ? [{ label: breadcrumbCurrent }]
                        : isContractTemplateEdit
                          ? [{ label: 'Chỉnh sửa' }]
                          : [{ label: 'Thêm mẫu hợp đồng' }]),
                    ],
                  }
                : isContractEdit
                  ? {
                      breadcrumbItems: [
                        { label: 'Trang chủ', path: '/' },
                        {
                          label: 'Hợp đồng',
                          path: ROUTES.PROJECT.CONTRACTS,
                        },
                        ...(contractDetailQuery.data
                          ? [
                              {
                                label: contractDetailQuery.data.name,
                                path: buildPath(
                                  ROUTES.PROJECT.CONTRACT_DETAIL,
                                  {
                                    id: contractDetailQuery.data.id,
                                  },
                                ),
                              },
                            ]
                          : [{ label: 'Đang tải hợp đồng...' }]),
                        { label: 'Chỉnh sửa' },
                      ],
                    }
                  : isContractCreate
                    ? {
                        breadcrumbItems: [
                          { label: 'Trang chủ', path: '/' },
                          { label: 'Hợp đồng', path: ROUTES.PROJECT.CONTRACTS },
                          { label: 'Thêm hợp đồng' },
                        ],
                      }
                    : {}),
        }}
      />
      <CustomerCreateDialog
        open={customerCreateOpen}
        onOpenChange={setCustomerCreateOpen}
      />
      <EmployeeCreateDialog
        open={employeeCreateOpen}
        onOpenChange={setEmployeeCreateOpen}
      />
    </>
  );
}
