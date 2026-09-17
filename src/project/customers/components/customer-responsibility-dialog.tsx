import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmployeeIdentity } from '../../employees/components/employee-identity';
import { useCustomerResponsibilityWorkspace } from '../hooks/use-customer-responsibility-workspace';
import type {
  CustomerResponsibilityAssignmentInput,
  CustomerResponsibilityEmployee,
  CustomerResponsibilityRole,
} from '../model/customer-responsibility';

interface DraftAssignment {
  employeeId: string;
  allRoles: boolean;
  responsibilityRoleIds: string[];
}

export interface CustomerResponsibilityEditorProps {
  tenantId: string;
  customerId: string;
  enabled?: boolean;
  canManage: boolean;
  draftAssignments?: CustomerResponsibilityAssignmentInput[] | null;
  onAssignmentsChange?: (
    assignments: CustomerResponsibilityAssignmentInput[],
  ) => void;
  onValidationChange?: (isValid: boolean) => void;
}

export function CustomerResponsibilityEditor({
  tenantId,
  customerId,
  enabled = true,
  canManage,
  draftAssignments: controlledAssignments,
  onAssignmentsChange,
  onValidationChange,
}: CustomerResponsibilityEditorProps) {
  const { workspaceQuery } = useCustomerResponsibilityWorkspace({
    tenantId,
    customerId,
    enabled,
  });
  const [localDraftAssignments, setLocalDraftAssignments] = useState<
    DraftAssignment[]
  >([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const notifyDraftChange = useCallback(
    (nextAssignments: DraftAssignment[]) => {
      const assignments: CustomerResponsibilityAssignmentInput[] =
        nextAssignments.map((assignment) => ({
          employeeId: assignment.employeeId,
          allRoles: assignment.allRoles,
          responsibilityRoleIds: assignment.responsibilityRoleIds,
        }));
      onAssignmentsChange?.(assignments);
      onValidationChange?.(
        nextAssignments.every(
          (assignment) =>
            assignment.allRoles || assignment.responsibilityRoleIds.length > 0,
        ),
      );
    },
    [onAssignmentsChange, onValidationChange],
  );

  useEffect(() => {
    if (
      !enabled ||
      !workspaceQuery.data ||
      (controlledAssignments !== undefined && controlledAssignments !== null)
    ) {
      return;
    }

    const nextAssignments = workspaceQuery.data.assignments.map(
      (assignment) => ({
        employeeId: assignment.employeeId,
        allRoles: assignment.allRoles === true,
        responsibilityRoleIds: [...assignment.responsibilityRoleIds],
      }),
    );
    setLocalDraftAssignments(nextAssignments);
    setSelectedEmployeeId('');
    notifyDraftChange(nextAssignments);
  }, [controlledAssignments, enabled, notifyDraftChange, workspaceQuery.data]);

  const draftAssignments: DraftAssignment[] =
    controlledAssignments ?? localDraftAssignments;

  const employeesById = useMemo(
    () =>
      new Map(
        (workspaceQuery.data?.employees ?? []).map((employee) => [
          employee.id,
          employee,
        ]),
      ),
    [workspaceQuery.data?.employees],
  );
  const availableEmployeeOptions = useMemo(
    () =>
      (workspaceQuery.data?.employees ?? [])
        .filter(
          (employee) =>
            employee.status === 'active' &&
            !draftAssignments.some(
              (assignment) => assignment.employeeId === employee.id,
            ),
        )
        .map<SelectOption<CustomerResponsibilityEmployee>>((employee) => ({
          value: employee.id,
          data: employee,
          searchableText: `${employee.displayName} ${employee.employeeCode}`,
          label: <EmployeeIdentity employee={employee} />,
        })),
    [draftAssignments, workspaceQuery.data?.employees],
  );
  const roles = workspaceQuery.data?.roles ?? [];

  function updateDraftAssignments(
    update: (current: DraftAssignment[]) => DraftAssignment[],
  ) {
    const nextAssignments = update(draftAssignments);
    if (controlledAssignments === undefined || controlledAssignments === null) {
      setLocalDraftAssignments(nextAssignments);
    }
    notifyDraftChange(nextAssignments);
  }

  function addEmployee(
    option: SelectOption<CustomerResponsibilityEmployee> | undefined,
  ) {
    if (!canManage || !option?.data) return;
    updateDraftAssignments((current) => [
      ...current,
      {
        employeeId: option.data.id,
        allRoles: false,
        responsibilityRoleIds: [],
      },
    ]);
    setSelectedEmployeeId('');
  }

  function removeEmployee(employeeId: string) {
    if (!canManage) return;
    updateDraftAssignments((current) =>
      current.filter((assignment) => assignment.employeeId !== employeeId),
    );
  }

  function setRoleEnabled(
    employeeId: string,
    roleId: string,
    enabledRole: boolean,
  ) {
    if (!canManage) return;
    updateDraftAssignments((current) =>
      current.map((assignment) => {
        if (assignment.employeeId !== employeeId) return assignment;

        const roleIds = new Set(assignment.responsibilityRoleIds);
        if (enabledRole) roleIds.add(roleId);
        else roleIds.delete(roleId);

        return {
          ...assignment,
          allRoles: false,
          responsibilityRoleIds: [...roleIds],
        };
      }),
    );
  }

  function setAllRoles(employeeId: string, allRoles: boolean) {
    if (!canManage) return;
    updateDraftAssignments((current) =>
      current.map((assignment) =>
        assignment.employeeId === employeeId
          ? {
              ...assignment,
              allRoles,
              responsibilityRoleIds: allRoles
                ? []
                : assignment.responsibilityRoleIds,
            }
          : assignment,
      ),
    );
  }

  const isLoading = workspaceQuery.isPending;
  const isError = workspaceQuery.isError;

  return (
    <div className="space-y-5">
      {canManage ? (
        <OptionSelect
          value={selectedEmployeeId}
          options={availableEmployeeOptions}
          size="md"
          onChange={setSelectedEmployeeId}
          onSelect={addEmployee}
          placeholder="Thêm nhân viên phụ trách"
          searchPlaceholder="Tìm theo tên hoặc mã nhân viên..."
          emptyMessage="Không còn nhân viên phù hợp"
          disabled={isLoading || isError}
          canDeselect={false}
          renderOption={(option) => option.label}
        />
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Đang tải danh sách nhân viên và vai trò...
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(workspaceQuery.error)}
        </div>
      ) : draftAssignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có nhân viên phụ trách.
        </p>
      ) : (
        <Accordion type="multiple" variant="outline">
          {draftAssignments.map((assignment) => {
            const employee = employeesById.get(assignment.employeeId);
            if (!employee) return null;

            return (
              <ResponsibleEmployeeCard
                key={employee.id}
                employee={employee}
                roleIds={assignment.responsibilityRoleIds}
                allRoles={assignment.allRoles}
                roles={roles.filter(
                  (role) =>
                    employee.roleIds.includes(role.id) ||
                    assignment.responsibilityRoleIds.includes(role.id),
                )}
                canManage={canManage}
                onRemove={() => removeEmployee(employee.id)}
                onRoleChange={(roleId, enabledRole) =>
                  setRoleEnabled(employee.id, roleId, enabledRole)
                }
                onAllRolesChange={(allRoles) =>
                  setAllRoles(employee.id, allRoles)
                }
              />
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

export function CustomerResponsibilityDialog({
  open,
  onOpenChange,
  tenantId,
  customerId,
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
  const [assignments, setAssignments] = useState<
    CustomerResponsibilityAssignmentInput[]
  >([]);
  const [isValid, setIsValid] = useState(true);

  async function handleSave() {
    try {
      await saveMutation.mutateAsync(assignments);
      toast.success('Đã cập nhật nhân viên và vai trò phụ trách.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 pe-14 text-start">
          <DialogTitle>Nhân viên phụ trách</DialogTitle>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <CustomerResponsibilityEditor
            tenantId={tenantId}
            customerId={customerId}
            enabled={open}
            canManage
            onAssignmentsChange={setAssignments}
            onValidationChange={setIsValid}
          />
        </DialogBody>
        <DialogFooter className="shrink-0 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleSave()}
            loading={saveMutation.isPending}
            loadingText="Đang lưu..."
            disabled={
              workspaceQuery.isPending || workspaceQuery.isError || !isValid
            }
          >
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResponsibleEmployeeCard({
  employee,
  roleIds,
  allRoles,
  roles,
  canManage,
  onRemove,
  onRoleChange,
  onAllRolesChange,
}: {
  employee: CustomerResponsibilityEmployee;
  roleIds: string[];
  allRoles: boolean;
  roles: CustomerResponsibilityRole[];
  canManage: boolean;
  onRemove: () => void;
  onRoleChange: (roleId: string, enabled: boolean) => void;
  onAllRolesChange: (allRoles: boolean) => void;
}) {
  const activeRoleCount = roles.filter((role) => role.isActive).length;
  const selectedRoleCount = roleIds.filter((roleId) =>
    roles.some((role) => role.id === roleId && role.isActive),
  ).length;
  const selectedRoleIds = new Set(roleIds);
  const hasNoRole = !allRoles && selectedRoleCount === 0;

  return (
    <AccordionItem value={employee.id}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <AccordionTrigger className="w-full text-start hover:no-underline">
            <div className="flex w-full min-w-0 items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <EmployeeIdentity employee={employee} />
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {allRoles
                  ? 'Tất cả vai trò'
                  : `${selectedRoleCount}/${activeRoleCount} vai trò`}
              </span>
            </div>
          </AccordionTrigger>
        </div>
        {canManage ? (
          <Button
            type="button"
            mode="icon"
            variant="ghost"
            aria-label={`Xóa ${employee.displayName} khỏi khách hàng`}
            className="shrink-0 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        ) : null}
      </div>
      <AccordionContent>
        <div className="space-y-3 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={allRoles}
              disabled={!canManage}
              onCheckedChange={(value) => onAllRolesChange(value === true)}
            />
            <span className="inline-flex items-center gap-1">
              Tất cả vai trò
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    aria-label="Áp dụng tất cả vai trò của nhân viên"
                    className="inline-flex size-4 items-center justify-center text-muted-foreground"
                  >
                    <Info className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Áp dụng tất cả vai trò của nhân viên
                </TooltipContent>
              </Tooltip>
            </span>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {roles.map((role) => {
              const checked = selectedRoleIds.has(role.id);
              return (
                <label
                  key={role.id}
                  className="flex items-start gap-2.5 rounded-md px-1 py-1 text-sm hover:bg-accent/50"
                >
                  <Checkbox
                    checked={checked}
                    disabled={!canManage || !role.isActive || allRoles}
                    onCheckedChange={(value) =>
                      onRoleChange(role.id, value === true)
                    }
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">
                      {role.name}
                    </span>
                    {!role.isActive ? (
                      <span className="block text-xs text-muted-foreground">
                        Vai trò không còn hoạt động
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        {canManage && hasNoRole ? (
          <p className="mt-2 text-xs text-destructive">
            Cần chọn ít nhất một vai trò phụ trách.
          </p>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}
