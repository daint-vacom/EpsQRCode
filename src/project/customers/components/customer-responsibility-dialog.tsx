import { useEffect, useMemo, useState } from 'react';
import { Check, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tag } from '@/components/ui/tag';
import { useCustomerResponsibilityWorkspace } from '../hooks/use-customer-responsibility-workspace';
import type {
  CustomerResponsibilityAssignmentInput,
  CustomerResponsibilityEmployee,
} from '../model/customer-responsibility';
import { CustomerResponsibilityDialogShell } from './customer-responsibility-dialog-shell.generated';

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function employeeInitials(employee: CustomerResponsibilityEmployee) {
  return employee.displayName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function CustomerResponsibilityDialog({
  open,
  onOpenChange,
  tenantId,
  customerId,
  customerName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  customerId: string;
  customerName: string;
}) {
  const { workspaceQuery, saveMutation } = useCustomerResponsibilityWorkspace({
    tenantId,
    customerId,
    enabled: open,
  });
  const [selectedRoleIdsByEmployee, setSelectedRoleIdsByEmployee] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    if (!open || !workspaceQuery.data) return;

    setSelectedRoleIdsByEmployee(
      Object.fromEntries(
        workspaceQuery.data.assignments.map((assignment) => [
          assignment.employeeId,
          [...assignment.responsibilityRoleIds],
        ]),
      ),
    );
  }, [open, workspaceQuery.data]);

  const selectedEmployeeIds = useMemo(
    () => Object.keys(selectedRoleIdsByEmployee),
    [selectedRoleIdsByEmployee],
  );
  const canConfirm = selectedEmployeeIds.every(
    (employeeId) => (selectedRoleIdsByEmployee[employeeId] ?? []).length > 0,
  );

  function toggleEmployee(employee: CustomerResponsibilityEmployee) {
    setSelectedRoleIdsByEmployee((current) => {
      if (current[employee.id]) {
        const next = { ...current };
        delete next[employee.id];
        return next;
      }

      return {
        ...current,
        [employee.id]: [],
      };
    });
  }

  function toggleRole(employeeId: string, roleId: string) {
    setSelectedRoleIdsByEmployee((current) => ({
      ...current,
      [employeeId]: toggleValue(current[employeeId] ?? [], roleId),
    }));
  }

  async function handleSave() {
    const assignments: CustomerResponsibilityAssignmentInput[] =
      selectedEmployeeIds.map((employeeId) => ({
        employeeId,
        responsibilityRoleIds: selectedRoleIdsByEmployee[employeeId] ?? [],
      }));

    try {
      await saveMutation.mutateAsync(assignments);
      toast.success('Đã cập nhật người phụ trách khách hàng.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  const isBusy = workspaceQuery.isLoading || saveMutation.isPending;

  return (
    <CustomerResponsibilityDialogShell
      open={open}
      onOpenChange={(nextOpen) => {
        if (!saveMutation.isPending) onOpenChange(nextOpen);
      }}
      dialogTitle={`Phân công nhân viên · ${customerName}`}
      onCancel={() => onOpenChange(false)}
      onConfirm={() => void handleSave()}
      isSaving={saveMutation.isPending}
      canConfirm={!isBusy && canConfirm}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Chọn nhân viên và vai trò nghiệp vụ của họ đối với khách hàng này. Vai
          trò này chỉ áp dụng trong quan hệ với khách hàng, không thay đổi vai
          trò phân quyền toàn hệ thống.
        </p>

        {workspaceQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : workspaceQuery.isError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {getApiErrorMessage(workspaceQuery.error)}
          </div>
        ) : workspaceQuery.data?.employees.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Chưa có nhân viên khả dụng để phân công.
          </div>
        ) : (
          <div className="space-y-2">
            {workspaceQuery.data?.employees.map((employee) => {
              const selected = Boolean(selectedRoleIdsByEmployee[employee.id]);
              const selectedRoleIds =
                selectedRoleIdsByEmployee[employee.id] ?? [];
              const isInactive = employee.status === 'inactive';

              return (
                <div
                  key={employee.id}
                  className="rounded-lg border border-border/80 bg-card p-3"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleEmployee(employee)}
                      disabled={isInactive && !selected}
                      aria-label={`Chọn ${employee.displayName}`}
                      className="mt-1"
                    />
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {employeeInitials(employee) || (
                        <UserRound className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">
                          {employee.displayName}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {employee.employeeCode}
                        </span>
                        {isInactive ? (
                          <Tag size="sm" shape="circle" color="#64748b">
                            Ngừng hoạt động
                          </Tag>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[employee.jobTitle, employee.department]
                          .filter(Boolean)
                          .join(' · ') || 'Chưa cập nhật chức vụ'}
                      </p>
                    </div>
                  </div>

                  {selected ? (
                    <div className="ms-11 mt-3 border-s border-border ps-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Vai trò phụ trách
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {workspaceQuery.data?.roles.map((role) => {
                          const roleSelected = selectedRoleIds.includes(
                            role.id,
                          );
                          return (
                            <Button
                              key={role.id}
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-pressed={roleSelected}
                              className={
                                roleSelected
                                  ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                                  : undefined
                              }
                              onClick={() => toggleRole(employee.id, role.id)}
                            >
                              {roleSelected ? <Check /> : null}
                              {role.name}
                            </Button>
                          );
                        })}
                      </div>
                      {selectedRoleIds.length === 0 ? (
                        <p className="mt-2 text-xs text-destructive">
                          Cần chọn ít nhất một vai trò phụ trách.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CustomerResponsibilityDialogShell>
  );
}
