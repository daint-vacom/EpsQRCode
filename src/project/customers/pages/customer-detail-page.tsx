import { useState, type ReactNode } from 'react';
import { ROUTES } from '@/constants/routes';
import { useSubjectTagFilter } from '@/project/tags/hooks/use-subject-tag-filter';
import { CUSTOMER_TAG_GROUP_CODE } from '@/project/tags/model/tag';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Search, Trash2, UserRoundSearch } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Badge } from '@/components/ui/badge';
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
  loadCustomerTabSummary,
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
import {
  BUSINESS_TYPE_LABELS,
  getCustomerFullAddress,
  VAT_DECLARATION_PERIOD_LABELS,
  type Customer,
} from '../model/customer';

function formatCustomerDate(value: string | null | undefined) {
  if (!value) return '';

  return new Intl.DateTimeFormat('vi-VN').format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );
}

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
  const fullAddress = getCustomerFullAddress(customer);

  return (
    <EntityDetailInformationCard>
      <EntityDetailInformationGrid className="grid-flow-row grid-cols-1 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-[repeat(5,auto)] xl:grid-cols-2">
        <CustomerInformationItem
          label="Trạng thái"
          value={<CustomerStatusBadge status={customer.status} />}
        />
        <CustomerInformationItem
          label="Ngày tạo KH"
          value={formatCustomerDate(customer.createdAt)}
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
          label="Kỳ kê khai thuế GTGT"
          value={VAT_DECLARATION_PERIOD_LABELS[customer.vatDeclarationPeriod]}
        />
        <CustomerInformationItem
          label="Người liên hệ"
          value={customer.contactName}
        />
        <CustomerInformationItem
          label="Chức danh"
          value={customer.contactTitle}
        />
        <CustomerInformationItem
          label="Số điện thoại"
          value={customer.phone || 'Chưa có số điện thoại'}
        />
        <CustomerInformationItem
          label="Email"
          value={customer.email || 'Chưa có email'}
        />
        <CustomerInformationItem label="Địa chỉ đầy đủ" value={fullAddress} />
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

function CustomerTabAlertBadge({
  alertCount,
  alertLabel,
}: {
  alertCount?: number | null;
  alertLabel: string;
}) {
  if (alertCount == null || alertCount <= 0) return null;

  return (
    <Badge
      size="sm"
      shape="circle"
      variant="destructive"
      appearance="light"
      aria-label={`${alertCount} ${alertLabel} cần xử lý`}
      title={`${alertCount} ${alertLabel} cần xử lý`}
    >
      {alertCount}
    </Badge>
  );
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

  const customerTabSummaryQuery = useQuery({
    queryKey: [
      'project',
      'customers',
      'tab-summary',
      customerQuery.data?.tenantId,
      customerQuery.data?.id,
    ],
    queryFn: () =>
      loadCustomerTabSummary(
        customerQuery.data!.tenantId,
        customerQuery.data!.id,
      ),
    enabled: Boolean(customerQuery.data),
    staleTime: 30 * 1000,
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
  const customerTagFilterQuery = useSubjectTagFilter('customer', {
    moduleCodes: [CUSTOMER_TAG_GROUP_CODE],
    allowCustomGroups: true,
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
      title="Chi tiết khách hàng"
      icon={UserRoundSearch}
      showBackButton
      actions={
        customerQuery.data ? (
          <>
            <Button
              type="button"
              variant="outline-primary"
              onClick={() => setDetailDialogOpen(true)}
            >
              <Search />
              Tra cứu
            </Button>
            <ShortcutTooltip label="Sửa thông tin" shortcut="Alt + E">
              <Button
                type="button"
                variant="outline-primary"
                onClick={() => setEditDialogOpen(true)}
                data-shortcut-action="edit"
              >
                <Pencil />
                Sửa thông tin
              </Button>
            </ShortcutTooltip>
            <Button
              type="button"
              variant="outline"
              mode="icon"
              size="icon"
              className="border-destructive/40 bg-transparent text-destructive hover:bg-destructive/5 hover:text-destructive"
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
        debtsCount={customerTabSummaryQuery.data?.debtCount}
        debtsAlertBadge={
          <CustomerTabAlertBadge
            alertCount={customerTabSummaryQuery.data?.dueOrOverdueDebtCount}
            alertLabel="khoản công nợ đến hạn hoặc quá hạn"
          />
        }
        contractsContent={<CustomerContractsTable customerId={customer.id} />}
        contractsCount={customerTabSummaryQuery.data?.contractCount}
        contractsAlertBadge={
          <CustomerTabAlertBadge
            alertCount={customerTabSummaryQuery.data?.dueOrOverdueContractCount}
            alertLabel="hợp đồng có khoản thanh toán đến hạn hoặc quá hạn"
          />
        }
        employeesContent={
          <CustomerResponsibilityPanel
            customer={customer}
            canManage={hasPermission('customers:update')}
          />
        }
        employeesCount={customerTabSummaryQuery.data?.responsibleEmployeeCount}
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
        softwareAccountsCount={
          customerTabSummaryQuery.data?.softwareAccountCount
        }
        className="h-auto min-h-0 overflow-visible p-0 lg:p-0"
      />
      <CustomerDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        customer={customer}
        customerTags={
          customerTagFilterQuery.data?.tagsBySubjectId[customer.id] ?? []
        }
        customFields={customerCustomFieldsQuery.data ?? []}
        customFieldValues={customerCustomDataQuery.data ?? {}}
        responsibilityWorkspace={customerResponsibilityQuery.data}
        softwareAccounts={customerSoftwareAccountsQuery.data ?? []}
        isLoading={
          customerCustomFieldsQuery.isPending ||
          customerCustomDataQuery.isPending ||
          customerTagFilterQuery.isPending ||
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
