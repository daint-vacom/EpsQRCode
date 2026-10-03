import { useMemo, useState, type ReactNode } from 'react';
import { ROUTES } from '@/constants/routes';
import {
  CUSTOMER_STATUS_LABELS,
  type CustomerStatus,
} from '@/project/customers/model/customer';
import { TagList } from '@/project/tags/components/tag-list';
import { useSubjectTagFilter } from '@/project/tags/hooks/use-subject-tag-filter';
import { loadWorkItems } from '@/project/work/api/work.api';
import { WorkPriorityIcon } from '@/project/work/components/work-priority-icon';
import { WorkStatusBadge } from '@/project/work/components/work-status-badge';
import { WORK_PRIORITY_LABELS } from '@/project/work/model/work';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  ClipboardList,
  Pencil,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading, SectionLoading } from '@/components/ui/loading';
import { PageHeader } from '@/components/ui/page-header';
import { ProgressCircle } from '@/components/ui/progress';
import { getAvatarInitials } from '@/components/common/avatar-identity';
import {
  GradientAvatar,
  IDENTITY_AVATAR_TONES,
} from '@/components/common/gradient-avatar';
import { EntityDetailProfileCard } from '@/components/layouts/entity-detail-layout';
import {
  deleteEmployee,
  loadEmployeeDetail,
  loadEmployeeResponsibilityWorkspace,
} from '../api/employees.api';
import { EmployeeDistributionChart } from '../charts/employee-distribution.chart.generated';
import {
  EmployeeRoleBadge,
  EmployeeStatusBadge,
} from '../components/employee-badges';
import { EmployeeCustomerAssignmentsCard } from '../components/employee-customer-assignments-card';
import { EmployeeEditDialog } from '../components/employee-edit-dialog';
import type { Employee, EmployeeRoleOption } from '../model/employee';
import type {
  EmployeeDistributionChartPoint,
  EmployeeResponsibilityWorkspace,
} from '../model/employee-responsibility';

const CUSTOMER_STATUS_COLORS: Record<CustomerStatus, string> = {
  active: 'var(--admin-success-dot)',
  inactive: 'var(--admin-red-primary)',
  uncontacted: 'var(--admin-neutral-400)',
};

const ROLE_CHART_COLORS: Record<EmployeeRoleOption['color'], string> = {
  blue: 'var(--admin-blue-primary)',
  violet: 'var(--admin-violet-primary)',
  red: 'var(--admin-red-primary)',
  green: 'var(--admin-success-text)',
  amber: 'var(--admin-amber-primary)',
  slate: 'var(--admin-neutral-500)',
};

function EmployeeProfileRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3">
      <dt className="pt-0.5 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('vi-VN').format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );
}

function summarizeResponsibility(workspace: EmployeeResponsibilityWorkspace) {
  const assignmentsByCustomerId = new Map(
    workspace.assignments.map((assignment) => [
      assignment.customerId,
      assignment,
    ]),
  );
  const assignedCustomers = workspace.customers.filter((customer) =>
    assignmentsByCustomerId.has(customer.id),
  );
  const customerCounts = new Map<CustomerStatus, number>([
    ['active', 0],
    ['inactive', 0],
    ['uncontacted', 0],
  ]);
  assignedCustomers.forEach((customer) => {
    customerCounts.set(
      customer.status,
      (customerCounts.get(customer.status) ?? 0) + 1,
    );
  });

  const customerLegend = (
    Object.keys(CUSTOMER_STATUS_LABELS) as CustomerStatus[]
  ).map((status) => ({
    label: CUSTOMER_STATUS_LABELS[status],
    count: customerCounts.get(status) ?? 0,
    color: CUSTOMER_STATUS_COLORS[status],
  }));
  const customerPoints: EmployeeDistributionChartPoint[] = customerLegend.map(
    (item) => ({ name: item.label, value: item.count, fill: item.color }),
  );

  const roleById = new Map(workspace.roles.map((role) => [role.id, role]));
  const roleCounts = new Map<string, number>();
  workspace.assignments.forEach((assignment) => {
    const roleIds = assignment.allRoles
      ? workspace.roles
          .filter((role) => role.customerAssignable)
          .map((role) => role.id)
      : assignment.responsibilityRoleIds;
    roleIds.forEach((roleId) => {
      if (!roleById.has(roleId)) return;
      roleCounts.set(roleId, (roleCounts.get(roleId) ?? 0) + 1);
    });
  });

  const roleLegend = workspace.roles.flatMap((role) => {
    const count = roleCounts.get(role.id) ?? 0;
    return count > 0
      ? [
          {
            label: role.name,
            count,
            color: ROLE_CHART_COLORS[role.color],
            roleId: role.id,
          },
        ]
      : [];
  });
  const roleAssignmentTotal = roleLegend.reduce(
    (total, role) => total + role.count,
    0,
  );
  const rolePoints: EmployeeDistributionChartPoint[] = roleLegend.map(
    (role) => ({
      name: role.label,
      value: role.count,
      fill: role.color,
    }),
  );
  return {
    customerTotal: assignedCustomers.length,
    roleAssignmentTotal,
    customerLegend,
    customerPoints,
    roleLegend: roleLegend.map((role) => ({
      ...role,
      percent: roleAssignmentTotal
        ? Math.round((role.count / roleAssignmentTotal) * 100)
        : 0,
    })),
    rolePoints,
  };
}

function StatisticsLegend({
  items,
  showPercent = false,
}: {
  items: Array<{
    label: string;
    count: number;
    color: string;
    percent?: number;
  }>;
  showPercent?: boolean;
}) {
  return (
    <ul className="mt-2 space-y-2">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex min-w-0 items-center gap-2 text-xs"
        >
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span
            className="min-w-0 flex-1 truncate text-muted-foreground"
            title={item.label}
          >
            {item.label}
          </span>
          <span className="shrink-0 tabular-nums font-medium text-foreground">
            {item.count}
            {showPercent ? ` · ${item.percent ?? 0}%` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EmptyStatisticsDonut({
  value = '0%',
  label = 'Chưa có dữ liệu',
}: {
  value?: string;
  label?: string;
}) {
  return (
    <div className="flex h-48 items-center justify-center">
      <ProgressCircle
        value={0}
        size={132}
        strokeWidth={10}
        indicatorClassName="text-emerald-500"
        trackClassName="text-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      >
        <div className="flex flex-col items-center text-center">
          <span className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {value}
          </span>
          <span className="mt-0.5 text-xs text-muted-foreground">{label}</span>
        </div>
      </ProgressCircle>
    </div>
  );
}

function EmployeeStatistics({
  workspace,
}: {
  workspace: EmployeeResponsibilityWorkspace;
}) {
  const stats = useMemo(() => summarizeResponsibility(workspace), [workspace]);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section className="min-w-0">
        {stats.customerTotal > 0 ? (
          <div className="relative mx-auto max-w-[260px]">
            <EmployeeDistributionChart
              data={stats.customerPoints}
              className="h-48"
            />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {stats.customerTotal}
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                Khách hàng
              </span>
            </div>
          </div>
        ) : (
          <EmptyStatisticsDonut value="0" label="Khách hàng" />
        )}
        <StatisticsLegend items={stats.customerLegend} />
      </section>

      <section className="min-w-0">
        {stats.roleLegend.length > 0 ? (
          <div className="relative mx-auto max-w-[260px]">
            <EmployeeDistributionChart
              data={stats.rolePoints}
              className="h-48"
            />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {stats.roleLegend.length}
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                Vai trò
              </span>
            </div>
          </div>
        ) : (
          <EmptyStatisticsDonut value="0" label="Vai trò" />
        )}
        {stats.roleLegend.length ? (
          <StatisticsLegend items={stats.roleLegend} showPercent />
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Chưa có vai trò chăm sóc được phân công.
          </p>
        )}
      </section>
    </div>
  );
}

export function EmployeeDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id = '' } = useParams<{ id: string }>();
  const { tenantId } = useTenant();
  const { hasPermission } = useUser();
  const canEditEmployee = hasPermission('organization:employee:update');
  const canDeleteEmployee = hasPermission('organization:employee:delete');
  const canViewCustomerData = hasPermission('customers:view');
  const canManageCustomerAssignments = hasPermission('customers:update');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: deleteEmployee,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['project', 'employees'],
      });
      toast.success('Đã xóa nhân viên.');
      navigate(ROUTES.PROJECT.EMPLOYEES, { replace: true });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const detailQuery = useQuery({
    queryKey: ['project', 'employees', 'detail', tenantId, id],
    queryFn: () => {
      if (!tenantId || !id) throw new Error('Thiếu thông tin nhân viên.');
      return loadEmployeeDetail(tenantId, id);
    },
    enabled: Boolean(tenantId && id),
  });
  const tagQuery = useSubjectTagFilter('employee', {
    moduleCodes: ['organization'],
    enabled: Boolean(id),
  });
  const responsibilityQuery = useQuery({
    queryKey: ['project', 'employees', 'detail-responsibility', tenantId, id],
    queryFn: () => {
      if (!tenantId || !id) throw new Error('Thiếu thông tin phân công.');
      return loadEmployeeResponsibilityWorkspace(tenantId, id);
    },
    enabled: Boolean(tenantId && id && detailQuery.data && canViewCustomerData),
    staleTime: 60 * 1000,
  });
  const workQuery = useQuery({
    queryKey: ['project', 'employees', 'detail-current-work', tenantId, id],
    queryFn: () => {
      if (!tenantId || !id) throw new Error('Thiếu thông tin nhân viên.');
      return loadWorkItems(tenantId, {
        search: '',
        statuses: ['in_progress'],
        priority: '',
        assigneeEmployeeId: id,
        scope: 'all',
        page: 1,
        pageSize: 100,
      });
    },
    enabled: Boolean(tenantId && id && detailQuery.data),
    staleTime: 60 * 1000,
  });

  const pageHeader = (employee?: Employee) => (
    <PageHeader
      title="Chi tiết nhân viên"
      icon={UsersRound}
      showBackButton
      actions={
        employee ? (
          <>
            {canEditEmployee ? (
              <Button
                type="button"
                variant="outline-primary"
                onClick={() => setEditDialogOpen(true)}
              >
                <Pencil />
                Chỉnh sửa
              </Button>
            ) : null}
            {canDeleteEmployee ? (
              <Button
                type="button"
                variant="outline"
                mode="icon"
                size="icon"
                className="border-destructive/40 bg-transparent text-destructive hover:bg-destructive/5 hover:text-destructive"
                aria-label={`Xóa nhân viên ${employee.displayName}`}
                title={`Xóa nhân viên ${employee.displayName}`}
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    />
  );
  const pageClassName =
    'flex min-h-full flex-col gap-admin-page-section p-4 lg:p-5';

  if (detailQuery.isPending) {
    return (
      <div className={pageClassName}>
        {pageHeader()}
        <PageLoading label="Đang tải trang..." />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className={pageClassName}>
        {pageHeader()}
        <ErrorState
          title={
            detailQuery.isError
              ? 'Không tải được nhân viên'
              : 'Không tìm thấy nhân viên'
          }
          description={
            detailQuery.isError
              ? getApiErrorMessage(detailQuery.error)
              : 'Nhân viên có thể đã bị xóa hoặc bạn không có quyền truy cập.'
          }
          onRetry={() => void detailQuery.refetch()}
        />
      </div>
    );
  }

  const employee = detailQuery.data;
  const employeeTags = tagQuery.data?.tagsBySubjectId[employee.id] ?? [];
  const currentWork = workQuery.data?.items ?? [];

  return (
    <div className={pageClassName}>
      {pageHeader(employee)}

      <div className="grid items-start gap-4 lg:gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <EntityDetailProfileCard
          className="h-fit lg:sticky lg:top-5"
          avatar={
            <GradientAvatar
              src={employee.avatarUrl}
              alt={employee.displayName}
              fallback={getAvatarInitials(employee.displayName)}
              tone={IDENTITY_AVATAR_TONES.employee}
              className="size-24 rounded-full text-2xl"
              fallbackClassName="text-2xl"
            />
          }
          title={employee.displayName}
          subtitle={employee.employeeCode}
        >
          <dl className="space-y-4">
            <EmployeeProfileRow label="Vai trò">
              {employee.roles.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {employee.roles.map((role) => (
                    <EmployeeRoleBadge
                      key={`${role.name}-${role.color}`}
                      role={role}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </EmployeeProfileRow>
            <EmployeeProfileRow label="Nhóm/danh mục">
              {tagQuery.isPending ? (
                <span className="text-muted-foreground">Đang tải...</span>
              ) : tagQuery.isError ? (
                <button
                  type="button"
                  className="text-left text-sm text-destructive underline-offset-4 hover:underline"
                  onClick={() => void tagQuery.refetch()}
                >
                  Không tải được · Thử lại
                </button>
              ) : (
                <TagList tags={employeeTags} maxVisible={4} />
              )}
            </EmployeeProfileRow>
            <EmployeeProfileRow label="Trạng thái">
              <EmployeeStatusBadge status={employee.status} />
            </EmployeeProfileRow>
          </dl>
        </EntityDetailProfileCard>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardHeading>
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <BarChart3 className="size-4" aria-hidden="true" />
                  </span>
                  <CardTitle>Khách hàng đang chăm sóc</CardTitle>
                </div>
              </CardHeading>
            </CardHeader>
            <CardContent>
              {!canViewCustomerData ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Bạn không có quyền xem dữ liệu khách hàng được phân công.
                </p>
              ) : responsibilityQuery.isPending ? (
                <SectionLoading label="Đang tải thống kê..." />
              ) : responsibilityQuery.isError ? (
                <ErrorState
                  title="Không tải được thống kê khách hàng"
                  description={getApiErrorMessage(responsibilityQuery.error)}
                  onRetry={() => void responsibilityQuery.refetch()}
                  className="min-h-40"
                />
              ) : responsibilityQuery.data ? (
                <EmployeeStatistics workspace={responsibilityQuery.data} />
              ) : null}
            </CardContent>
          </Card>

          <EmployeeCustomerAssignmentsCard
            employee={employee}
            canView={canViewCustomerData}
            canManage={canManageCustomerAssignments}
            workspace={responsibilityQuery.data}
            isLoading={responsibilityQuery.isPending}
            error={
              responsibilityQuery.isError ? responsibilityQuery.error : null
            }
            onRetry={() => void responsibilityQuery.refetch()}
          />

          <Card>
            <CardHeader>
              <CardHeading>
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <ClipboardList className="size-4" aria-hidden="true" />
                  </span>
                  <CardTitle>Công việc hiện tại</CardTitle>
                </div>
              </CardHeading>
              {workQuery.data ? (
                <span className="text-sm text-muted-foreground">
                  {workQuery.data.total} công việc
                </span>
              ) : null}
            </CardHeader>
            <CardContent className="p-0">
              {workQuery.isPending ? (
                <div className="p-5">
                  <SectionLoading label="Đang tải công việc..." />
                </div>
              ) : workQuery.isError ? (
                <ErrorState
                  title="Không tải được công việc đang thực hiện"
                  description={getApiErrorMessage(workQuery.error)}
                  onRetry={() => void workQuery.refetch()}
                />
              ) : currentWork.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
                  <ClipboardList
                    className="size-7 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-muted-foreground">
                    Nhân viên chưa có công việc đang thực hiện.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {currentWork.map((work) => (
                    <li
                      key={work.id}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-5 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-semibold text-foreground"
                          title={work.title}
                        >
                          {work.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{work.code}</span>
                          {work.plannedEndDate ? (
                            <span>Hạn {formatDate(work.plannedEndDate)}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                          title={`Độ ưu tiên: ${WORK_PRIORITY_LABELS[work.priority]}`}
                        >
                          <WorkPriorityIcon priority={work.priority} />
                          <span className="hidden sm:inline">
                            {WORK_PRIORITY_LABELS[work.priority]}
                          </span>
                        </span>
                        <WorkStatusBadge status={work.status} size="sm" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EmployeeEditDialog
        employee={employee}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteDialogOpen(false);
        }}
        title="Xóa nhân viên?"
        description={`Bạn có chắc muốn xóa nhân viên "${employee.displayName}"?`}
        confirmLabel="Xóa nhân viên"
        confirmVariant="destructive"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(employee.id)}
      />
    </div>
  );
}
