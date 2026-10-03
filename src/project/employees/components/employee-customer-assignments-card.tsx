import { useMemo, useState } from 'react';
import { CustomerIdentity } from '@/project/customers/components/customer-identity';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTable,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataGridActionButton } from '@/components/ui/data-grid-columns';
import { ErrorState } from '@/components/ui/error-state';
import {
  MultiSelect,
  type MultiSelectOption,
} from '@/components/ui/multi-select';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { saveEmployeeAccess } from '../api/employees.api';
import type { Employee, EmployeeRoleOption } from '../model/employee';
import type {
  EmployeeCustomerAssignmentInput,
  EmployeeCustomerOption,
  EmployeeResponsibilityWorkspace,
} from '../model/employee-responsibility';
import { EmployeeRoleBadge } from './employee-badges';
import { EmployeeCustomerAssignmentDialogShell } from './employee-customer-assignment-dialog-shell.generated';

type AssignmentDialogState =
  { mode: 'add' } | { mode: 'edit'; customerId: string } | null;

interface EmployeeCustomerAssignmentsCardProps {
  employee: Employee;
  canView: boolean;
  canManage: boolean;
  workspace?: EmployeeResponsibilityWorkspace;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}

function getAssignmentRoleLabel(
  assignment: EmployeeCustomerAssignmentInput,
  roleById: Map<string, EmployeeRoleOption>,
) {
  if (assignment.allRoles) return 'Tất cả vai trò';

  return assignment.responsibilityRoleIds
    .map((roleId) => roleById.get(roleId))
    .filter((role): role is EmployeeRoleOption => Boolean(role));
}

export function EmployeeCustomerAssignmentsCard({
  employee,
  canView,
  canManage,
  workspace,
  isLoading,
  error,
  onRetry,
}: EmployeeCustomerAssignmentsCardProps) {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [dialogState, setDialogState] = useState<AssignmentDialogState>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [allRoles, setAllRoles] = useState(true);
  const [customerToRemove, setCustomerToRemove] =
    useState<EmployeeCustomerOption | null>(null);

  const employeeRoleIds = useMemo(
    () => new Set(employee.roleIds),
    [employee.roleIds],
  );
  const assignableRoles = useMemo(
    () =>
      (workspace?.roles ?? []).filter(
        (role) =>
          role.customerAssignable &&
          role.isActive &&
          employeeRoleIds.has(role.id),
      ),
    [employeeRoleIds, workspace?.roles],
  );
  const roleOptions = useMemo<MultiSelectOption<EmployeeRoleOption>[]>(
    () =>
      assignableRoles.map((role) => ({
        value: role.id,
        label: role.name,
        searchableText: role.name,
        data: role,
      })),
    [assignableRoles],
  );
  const customerById = useMemo(
    () =>
      new Map(
        (workspace?.customers ?? []).map((customer) => [customer.id, customer]),
      ),
    [workspace?.customers],
  );
  const roleById = useMemo(
    () => new Map((workspace?.roles ?? []).map((role) => [role.id, role])),
    [workspace?.roles],
  );
  const assignmentByCustomerId = useMemo(
    () =>
      new Map(
        (workspace?.assignments ?? []).map((assignment) => [
          assignment.customerId,
          assignment,
        ]),
      ),
    [workspace?.assignments],
  );
  const assignedRows = useMemo(
    () =>
      (workspace?.assignments ?? []).flatMap((assignment) => {
        const customer = customerById.get(assignment.customerId);
        return customer ? [{ customer, assignment }] : [];
      }),
    [customerById, workspace?.assignments],
  );
  const unassignedActiveCustomers = useMemo(
    () =>
      (workspace?.customers ?? []).filter(
        (customer) =>
          customer.status === 'active' &&
          !assignmentByCustomerId.has(customer.id),
      ),
    [assignmentByCustomerId, workspace?.customers],
  );
  const customerOptions = useMemo<SelectOption<EmployeeCustomerOption>[]>(
    () =>
      unassignedActiveCustomers.map((customer) => ({
        value: customer.id,
        label: `${customer.customerCode} · ${customer.name}`,
        searchableText: `${customer.customerCode} ${customer.name}`,
        data: customer,
      })),
    [unassignedActiveCustomers],
  );

  const saveMutation = useMutation({
    mutationFn: async ({
      assignments,
    }: {
      assignments: EmployeeCustomerAssignmentInput[];
      successMessage: string;
    }) => {
      if (!tenantId) throw new Error('Chưa xác định tenant.');
      await saveEmployeeAccess(tenantId, employee.id, null, assignments);
    },
    onSuccess: async (_result, variables) => {
      toast.success(variables.successMessage);
      setDialogState(null);
      setCustomerToRemove(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            'project',
            'employees',
            'detail-responsibility',
            tenantId,
            employee.id,
          ],
        }),
        queryClient.invalidateQueries({ queryKey: ['project', 'customers'] }),
      ]);
    },
    onError: (mutationError) => toast.error(getApiErrorMessage(mutationError)),
  });

  const canManageAssignments = canManage && Boolean(employee.userId);
  const selectedCustomer = customerById.get(selectedCustomerId);
  const canConfirm = Boolean(
    canManageAssignments &&
    !saveMutation.isPending &&
    assignableRoles.length > 0 &&
    (dialogState?.mode === 'edit' || selectedCustomer) &&
    (allRoles || selectedRoleIds.length > 0),
  );

  function openAddDialog() {
    setSelectedCustomerId('');
    setSelectedRoleIds([]);
    setAllRoles(true);
    setDialogState({ mode: 'add' });
  }

  function openEditDialog(assignment: EmployeeCustomerAssignmentInput) {
    setSelectedCustomerId(assignment.customerId);
    setSelectedRoleIds(assignment.responsibilityRoleIds);
    setAllRoles(assignment.allRoles);
    setDialogState({ mode: 'edit', customerId: assignment.customerId });
  }

  function saveAssignment() {
    if (!workspace || !canConfirm) return;
    const nextAssignment: EmployeeCustomerAssignmentInput = {
      customerId:
        dialogState?.mode === 'edit'
          ? dialogState.customerId
          : selectedCustomerId,
      allRoles,
      responsibilityRoleIds: allRoles ? [] : selectedRoleIds,
    };
    const nextAssignments =
      dialogState?.mode === 'edit'
        ? workspace.assignments.map((assignment) =>
            assignment.customerId === nextAssignment.customerId
              ? nextAssignment
              : assignment,
          )
        : [...workspace.assignments, nextAssignment];

    saveMutation.mutate({
      assignments: nextAssignments,
      successMessage:
        dialogState?.mode === 'edit'
          ? 'Đã cập nhật phân công khách hàng.'
          : 'Đã thêm khách hàng vào danh sách phụ trách.',
    });
  }

  function removeAssignment() {
    if (!workspace || !customerToRemove || saveMutation.isPending) return;
    saveMutation.mutate({
      assignments: workspace.assignments.filter(
        (assignment) => assignment.customerId !== customerToRemove.id,
      ),
      successMessage: 'Đã gỡ phân công khách hàng.',
    });
  }

  const addDisabled =
    !canManageAssignments ||
    !canView ||
    unassignedActiveCustomers.length === 0 ||
    assignableRoles.length === 0;
  const addDisabledMessage = !canView
    ? 'Bạn không có quyền xem dữ liệu khách hàng được phân công.'
    : !employee.userId
      ? 'Cần liên kết tài khoản nhân viên trước khi phân công khách hàng.'
      : assignableRoles.length === 0
        ? 'Nhân viên chưa có vai trò đang hoạt động có thể phụ trách khách hàng.'
        : unassignedActiveCustomers.length === 0
          ? 'Không còn khách hàng đang hoạt động để phân công.'
          : undefined;

  return (
    <>
      <Card>
        <CardHeader className="flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <CardHeading>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <UsersRound className="size-4" aria-hidden="true" />
              </span>
              <CardTitle>Danh sách khách hàng</CardTitle>
            </div>
          </CardHeading>
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              disabled={addDisabled || isLoading || saveMutation.isPending}
              title={addDisabledMessage}
              onClick={openAddDialog}
            >
              <Plus />
              Thêm khách hàng
            </Button>
          ) : null}
        </CardHeader>

        {canManage && !employee.userId ? (
          <CardContent className="pb-0 pt-0 text-xs text-muted-foreground">
            Cần liên kết tài khoản nhân viên trước khi phân công khách hàng.
          </CardContent>
        ) : null}

        {!canView ? (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Bạn không có quyền xem dữ liệu khách hàng được phân công.
          </CardContent>
        ) : isLoading ? (
          <CardTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Vai trò phụ trách</TableHead>
                  {canManage ? (
                    <TableHead className="sticky right-0 z-10 w-24 bg-muted text-right">
                      Thao tác
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[0, 1, 2].map((row) => (
                  <TableRow key={row}>
                    <TableCell>
                      <Skeleton className="h-9 w-52" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-36" />
                    </TableCell>
                    {canManage ? (
                      <TableCell className="sticky right-0 z-[1] bg-card">
                        <Skeleton className="ml-auto h-8 w-16" />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardTable>
        ) : error ? (
          <CardContent className="p-0">
            <ErrorState
              title="Không tải được danh sách khách hàng"
              description={getApiErrorMessage(error)}
              onRetry={onRetry}
            />
          </CardContent>
        ) : (
          <CardTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Khách hàng</TableHead>
                  <TableHead className="min-w-[200px]">
                    Vai trò phụ trách
                  </TableHead>
                  {canManage ? (
                    <TableHead className="sticky right-0 z-10 w-24 bg-muted text-right">
                      Thao tác
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedRows.length ? (
                  assignedRows.map(({ customer, assignment }) => {
                    const assignmentRoles = getAssignmentRoleLabel(
                      assignment,
                      roleById,
                    );
                    return (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <CustomerIdentity customer={customer} />
                        </TableCell>
                        <TableCell>
                          {typeof assignmentRoles === 'string' ? (
                            <span className="text-sm text-muted-foreground">
                              {assignmentRoles}
                            </span>
                          ) : assignmentRoles.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {assignmentRoles.map((role) => (
                                <EmployeeRoleBadge key={role.id} role={role} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Chưa gán vai trò
                            </span>
                          )}
                        </TableCell>
                        {canManage ? (
                          <TableCell className="sticky right-0 z-[1] bg-card">
                            <div className="flex justify-end gap-1">
                              <DataGridActionButton
                                type="button"
                                action="edit"
                                size="icon"
                                aria-label={`Sửa phân công ${customer.name}`}
                                tooltip="Sửa phân công"
                                disabled={
                                  !canManageAssignments ||
                                  saveMutation.isPending ||
                                  assignableRoles.length === 0
                                }
                                onClick={() => openEditDialog(assignment)}
                              >
                                <Pencil />
                              </DataGridActionButton>
                              <DataGridActionButton
                                type="button"
                                action="delete"
                                size="icon"
                                aria-label={`Gỡ phân công ${customer.name}`}
                                tooltip="Gỡ phân công"
                                disabled={
                                  !canManageAssignments ||
                                  saveMutation.isPending
                                }
                                onClick={() => setCustomerToRemove(customer)}
                              >
                                <Trash2 />
                              </DataGridActionButton>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={canManage ? 3 : 2}
                      className="h-28 text-center text-sm text-muted-foreground"
                    >
                      Nhân viên chưa được phân công khách hàng.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardTable>
        )}
      </Card>

      <EmployeeCustomerAssignmentDialogShell
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open && !saveMutation.isPending) setDialogState(null);
        }}
        dialogTitle={
          dialogState?.mode === 'edit'
            ? 'Chỉnh sửa phân công'
            : 'Thêm khách hàng phụ trách'
        }
        onCancel={() => setDialogState(null)}
        onConfirm={saveAssignment}
        isSaving={saveMutation.isPending}
        canConfirm={canConfirm}
      >
        <div className="space-y-5">
          {dialogState?.mode === 'add' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Khách hàng
              </label>
              <OptionSelect<EmployeeCustomerOption>
                value={selectedCustomerId}
                options={customerOptions}
                onChange={setSelectedCustomerId}
                placeholder="Chọn khách hàng"
                searchPlaceholder="Tìm khách hàng..."
                emptyMessage="Không tìm thấy khách hàng đang hoạt động"
                ariaLabel="Chọn khách hàng cần phân công"
                size="lg"
                renderOption={(option) =>
                  option.data ? (
                    <CustomerIdentity customer={option.data} />
                  ) : (
                    option.label
                  )
                }
                triggerContent={(option) =>
                  option?.data ? (
                    <CustomerIdentity customer={option.data} />
                  ) : (
                    'Chọn khách hàng'
                  )
                }
              />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Khách hàng</p>
              {selectedCustomer ? (
                <CustomerIdentity customer={selectedCustomer} />
              ) : null}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              Vai trò phụ trách
            </p>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
              <Checkbox
                checked={allRoles}
                disabled={saveMutation.isPending}
                onCheckedChange={(checked) => {
                  const nextAllRoles = checked === true;
                  setAllRoles(nextAllRoles);
                  if (nextAllRoles) setSelectedRoleIds([]);
                }}
              />
              Áp dụng tất cả vai trò có thể chăm sóc khách hàng của nhân viên
            </label>
            {!allRoles ? (
              <MultiSelect<EmployeeRoleOption>
                value={selectedRoleIds}
                options={roleOptions}
                onChange={setSelectedRoleIds}
                placeholder="Chọn vai trò phụ trách"
                searchPlaceholder="Tìm vai trò..."
                emptyMessage="Không có vai trò phù hợp"
                disabled={saveMutation.isPending || roleOptions.length === 0}
                showSelectedOptionWrapper
                renderSelectedOption={(option, onRemove) =>
                  option.data ? (
                    <EmployeeRoleBadge role={option.data} onRemove={onRemove} />
                  ) : (
                    option.label
                  )
                }
                size="lg"
              />
            ) : null}
            {assignableRoles.length === 0 ? (
              <p className="text-xs text-destructive">
                Nhân viên chưa có vai trò đang hoạt động có thể phụ trách khách
                hàng.
              </p>
            ) : null}
          </div>
        </div>
      </EmployeeCustomerAssignmentDialogShell>

      <ConfirmDialog
        open={customerToRemove !== null}
        onOpenChange={(open) => {
          if (!open && !saveMutation.isPending) setCustomerToRemove(null);
        }}
        title="Gỡ phân công khách hàng?"
        description={`Khách hàng ${customerToRemove?.name ?? ''} sẽ không còn nằm trong danh sách phụ trách của nhân viên này.`}
        confirmLabel="Gỡ phân công"
        confirmVariant="destructive"
        isConfirming={saveMutation.isPending}
        closeOnConfirm={false}
        onConfirm={removeAssignment}
      />
    </>
  );
}
