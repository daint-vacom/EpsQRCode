import { useState, type ReactNode } from 'react';
import { ROUTES } from '@/constants/routes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Search, Trash2, UserRoundSearch } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/loading';
import { PageHeader } from '@/components/ui/page-header';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import {
  EntityDetailInformationCard,
  EntityDetailInformationGrid,
  EntityDetailInformationItem,
  EntityDetailProfileCard,
} from '@/components/layouts/entity-detail-layout';
import {
  deleteCustomer,
  loadCustomerCustomFields,
  loadCustomerCustomFieldValues,
  loadCustomerDetail,
  loadCustomerResponsibilityWorkspace,
  loadCustomerSoftwareAccounts,
} from '../api/customers.api';
import { CustomerAvatar } from '../components/customer-avatar';
import { CustomerContractsTable } from '../components/customer-contracts-table';
import { CustomerDebtsTab } from '../components/customer-debts-tab';
import { CustomerDetailDialog } from '../components/customer-detail-dialog';
import { CustomerDetailLayout } from '../components/customer-detail-layout.generated';
import { CustomerEditDialog } from '../components/customer-edit-dialog';
import { CustomerOverviewContent } from '../components/customer-overview-content';
import { CustomerResponsibilityPanel } from '../components/customer-responsibility-panel';
import { CustomerSoftwareAccountsPanel } from '../components/customer-software-accounts-panel';
import { CustomerStatusBadge } from '../components/customer-status-badge';
import { BUSINESS_TYPE_LABELS, type Customer } from '../model/customer';

function CustomerProfileCard({ customer }: { customer: Customer }) {
  return (
    <EntityDetailProfileCard
      avatar={
        <CustomerAvatar
          customer={customer}
          ringSize="large"
          className="size-24 rounded-full text-2xl"
        />
      }
      title={customer.name}
      subtitle={customer.customerCode}
    />
  );
}

function CustomerInformationItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <EntityDetailInformationItem
      label={label}
      value={value}
      className="grid grid-cols-[minmax(7rem,0.85fr)_minmax(0,1.15fr)] items-start gap-x-3 space-y-0 [&>p]:min-w-0 [&>p]:break-words [&>p]:[overflow-wrap:anywhere] [&>div]:min-w-0 [&>div]:break-words [&>div]:[overflow-wrap:anywhere]"
    />
  );
}

function CustomerInformationCard({ customer }: { customer: Customer }) {
  return (
    <EntityDetailInformationCard>
      <EntityDetailInformationGrid className="grid-flow-row grid-cols-1 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-5 xl:grid-cols-2">
        <CustomerInformationItem
          label="Trạng thái"
          value={<CustomerStatusBadge status={customer.status} />}
        />
        <CustomerInformationItem
          label="Số điện thoại"
          value={customer.phone || 'Chưa có số điện thoại'}
        />
        <CustomerInformationItem
          label="Email"
          value={customer.email || 'Chưa có email'}
        />
        <CustomerInformationItem
          label="Loại hình doanh nghiệp"
          value={BUSINESS_TYPE_LABELS[customer.businessType]}
        />
        <CustomerInformationItem
          label="Mã số thuế"
          value={customer.businessRegistrationCode}
        />
        <CustomerInformationItem
          label="Tỉnh/Thành phố"
          value={customer.regionName}
        />
        <CustomerInformationItem
          label="Quận/Huyện"
          value={customer.districtName}
        />
        <CustomerInformationItem label="Phường/Xã" value={customer.wardName} />
        <CustomerInformationItem
          label="Số nhà, tên đường"
          value={customer.streetAddress}
        />
        <CustomerInformationItem
          label="Người liên hệ"
          value={customer.contactName}
        />
      </EntityDetailInformationGrid>
    </EntityDetailInformationCard>
  );
}

function useCustomerQuery() {
  const { userId } = useUser();
  const { tenantId } = useTenant();
  const { id } = useParams<{ id: string }>();

  return useQuery({
    queryKey: ['project', 'customers', 'detail', userId, tenantId, id],
    queryFn: () => {
      if (!userId || !tenantId || !id) {
        throw new Error('Thiếu thông tin khách hàng.');
      }
      return loadCustomerDetail(userId, id, tenantId);
    },
    enabled: Boolean(userId && tenantId && id),
  });
}

export function CustomerDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const customerQuery = useCustomerQuery();
  const { hasPermission } = useUser();
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['project', 'customers'],
      });
      toast.success('Đã xóa khách hàng.');
      navigate(ROUTES.PROJECT.CUSTOMERS, { replace: true });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const customerCustomFieldsQuery = useQuery({
    queryKey: [
      'project',
      'customers',
      'custom-fields',
      customerQuery.data?.tenantId,
    ],
    queryFn: () => loadCustomerCustomFields(customerQuery.data!.tenantId),
    enabled: Boolean(detailDialogOpen && customerQuery.data),
    staleTime: 60 * 1000,
  });
  const customerCustomDataQuery = useQuery({
    queryKey: [
      'project',
      'customers',
      'custom-data',
      customerQuery.data?.tenantId,
      customerQuery.data?.id,
    ],
    queryFn: () =>
      loadCustomerCustomFieldValues(
        customerQuery.data!.tenantId,
        customerQuery.data!.id,
      ),
    enabled: Boolean(detailDialogOpen && customerQuery.data),
  });
  const customerResponsibilityQuery = useQuery({
    queryKey: [
      'project',
      'customers',
      'responsibility-workspace',
      customerQuery.data?.tenantId,
      customerQuery.data?.id,
    ],
    queryFn: () =>
      loadCustomerResponsibilityWorkspace(
        customerQuery.data!.tenantId,
        customerQuery.data!.id,
      ),
    enabled: Boolean(detailDialogOpen && customerQuery.data),
    staleTime: 60 * 1000,
  });
  const customerSoftwareAccountsQuery = useQuery({
    queryKey: [
      'project',
      'customers',
      'software-accounts',
      customerQuery.data?.tenantId,
      customerQuery.data?.id,
    ],
    queryFn: () => loadCustomerSoftwareAccounts(customerQuery.data!.id),
    enabled: Boolean(customerQuery.data),
    staleTime: 60 * 1000,
  });

  const pageHeader = (
    <PageHeader
      title={customerQuery.data?.name ?? 'Chi tiết khách hàng'}
      icon={UserRoundSearch}
      showBackButton
      actions={
        customerQuery.data ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailDialogOpen(true)}
            >
              <Search />
              Tra cứu
            </Button>
            <ShortcutTooltip label="Sửa thông tin" shortcut="Alt + E">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(true)}
                data-shortcut-action="edit"
              >
                <Pencil />
                Sửa thông tin
              </Button>
            </ShortcutTooltip>
            <Button
              type="button"
              variant="destructive"
              appearance="outline"
              mode="icon"
              size="icon"
              aria-label={`Xóa khách hàng ${customerQuery.data.name}`}
              title={`Xóa khách hàng ${customerQuery.data.name}`}
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        ) : undefined
      }
    />
  );

  if (customerQuery.isPending) {
    return (
      <div className="flex min-h-full flex-col gap-admin-page-section p-4 lg:p-5">
        {pageHeader}
        <PageLoading label="Đang tải thông tin khách hàng..." />
      </div>
    );
  }

  if (customerQuery.isError || !customerQuery.data) {
    return (
      <div className="flex min-h-full flex-col gap-admin-page-section p-4 lg:p-5">
        {pageHeader}
        <ErrorState
          title="Không tải được khách hàng"
          description={getApiErrorMessage(customerQuery.error)}
          onRetry={() => void customerQuery.refetch()}
        />
      </div>
    );
  }

  const customer = customerQuery.data;

  return (
    <div className="flex min-h-full flex-col gap-admin-page-section p-4 lg:p-5">
      {pageHeader}
      <CustomerDetailLayout
        profile={<CustomerProfileCard customer={customer} />}
        information={<CustomerInformationCard customer={customer} />}
        overviewContent={<CustomerOverviewContent customer={customer} />}
        debtsContent={<CustomerDebtsTab customer={customer} />}
        contractsContent={<CustomerContractsTable customerId={customer.id} />}
        employeesContent={
          <CustomerResponsibilityPanel
            customer={customer}
            canManage={hasPermission('customers:update')}
          />
        }
        softwareAccountsContent={
          <CustomerSoftwareAccountsPanel
            tenantId={customer.tenantId}
            customerId={customer.id}
            customerName={customer.name}
            accounts={customerSoftwareAccountsQuery.data ?? []}
            isLoading={customerSoftwareAccountsQuery.isPending}
            error={customerSoftwareAccountsQuery.error}
          />
        }
        className="h-auto min-h-0 overflow-visible p-0 lg:p-0"
      />
      <CustomerDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        customer={customer}
        customFields={customerCustomFieldsQuery.data ?? []}
        customFieldValues={customerCustomDataQuery.data ?? {}}
        responsibilityWorkspace={customerResponsibilityQuery.data}
        softwareAccounts={customerSoftwareAccountsQuery.data ?? []}
        isLoading={
          customerCustomFieldsQuery.isPending ||
          customerCustomDataQuery.isPending ||
          customerResponsibilityQuery.isPending ||
          customerSoftwareAccountsQuery.isPending
        }
      />
      <CustomerEditDialog
        customer={customer}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        canManageResponsibility={hasPermission('customers:update')}
        onAddCustomField={() => {
          window.open(
            `${ROUTES.PROJECT.DATA_CONFIGURATION}?entity=customer`,
            '_blank',
            'noopener,noreferrer',
          );
        }}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Xóa khách hàng?"
        description={`Bạn có chắc muốn xóa khách hàng "${customer.name}"?`}
        confirmLabel="Xóa khách hàng"
        confirmVariant="destructive"
        onConfirm={() => deleteMutation.mutate(customer.id)}
      />
    </div>
  );
}
