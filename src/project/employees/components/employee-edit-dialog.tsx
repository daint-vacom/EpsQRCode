import { useEffect, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import {
  createEmployeeAccount,
  loadEmployeeCustomFields,
  loadEmployeeCustomFieldValues,
  saveEmployeeAccess,
  saveEmployeeCustomFieldValues,
  updateEmployee,
  updateEmployeeUsername,
  uploadEmployeeAvatar,
} from '../api/employees.api';
import {
  EmployeeFormDialog,
  useEmployeeForm,
} from '../forms/employee-form.generated';
import { useEmployeeAccessWorkspace } from '../hooks/use-employee-access-workspace';
import {
  mapEmployeeToFormValues,
  type Employee,
  type EmployeeFormValues,
} from '../model/employee';
import type { EmployeeCustomerAssignmentInput } from '../model/employee-responsibility';

interface EmployeeEditDialogProps {
  employee: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeEditDialog({
  employee,
  open,
  onOpenChange,
}: EmployeeEditDialogProps) {
  const { tenantId } = useTenant();
  const { hasPermission } = useUser();
  const queryClient = useQueryClient();
  const form = useEmployeeForm();
  const [employeeImageFile, setEmployeeImageFile] = useState<File | null>(null);
  const [customerAssignments, setCustomerAssignments] = useState<
    EmployeeCustomerAssignmentInput[]
  >([]);
  const canManageEmployeeRoles = hasPermission(
    'organization:employee:assign-role',
  );
  const canManageEmployeeAccount = hasPermission(
    'organization:employee:update',
  );
  const canManageCustomerAssignments = hasPermission('customers:update');
  const employeeAccess = useEmployeeAccessWorkspace({
    tenantId,
    employeeId: employee.id,
    enabled: open,
  });

  const employeeCustomFieldsQuery = useQuery({
    queryKey: ['project', 'employees', 'custom-fields', tenantId],
    queryFn: () => loadEmployeeCustomFields(tenantId!),
    enabled: Boolean(tenantId),
    staleTime: 60 * 1000,
  });
  const employeeCustomDataQuery = useQuery({
    queryKey: ['project', 'employees', 'custom-data', tenantId, employee.id],
    queryFn: () => loadEmployeeCustomFieldValues(tenantId!, employee.id),
    enabled: Boolean(tenantId && open),
  });

  useEffect(() => {
    if (!open || employeeCustomDataQuery.isLoading) return;

    form.reset({
      ...mapEmployeeToFormValues(employee),
      customFields: employeeCustomDataQuery.data ?? {},
    });
  }, [
    employee,
    employeeCustomDataQuery.data,
    employeeCustomDataQuery.isLoading,
    form,
    open,
  ]);

  useEffect(() => {
    if (!open) return;
    setEmployeeImageFile(null);
    setCustomerAssignments([]);
  }, [employee.id, open]);

  useEffect(() => {
    if (!open || !employeeAccess.responsibilityQuery.data) return;
    setCustomerAssignments(employeeAccess.responsibilityQuery.data.assignments);
  }, [employeeAccess.responsibilityQuery.data, open]);

  const saveMutation = useMutation({
    mutationFn: async ({
      values,
      assignments,
    }: {
      values: EmployeeFormValues;
      assignments: EmployeeCustomerAssignmentInput[];
    }) => {
      if (!tenantId) throw new Error('Chưa xác định tenant.');

      let savedEmployee = await updateEmployee(employee.id, values);

      if (employeeImageFile) {
        const imageUrl = await uploadEmployeeAvatar(
          tenantId,
          savedEmployee.id,
          employeeImageFile,
        );
        savedEmployee = await updateEmployee(savedEmployee.id, {
          ...values,
          imageUrl,
        });
      }

      if (savedEmployee.userId) {
        const requestedUsername = values.accountUsername.trim().toLowerCase();
        const currentUsername = employee.username?.toLowerCase() ?? '';
        if (requestedUsername && requestedUsername !== currentUsername) {
          const account = await updateEmployeeUsername(
            tenantId,
            savedEmployee.id,
            requestedUsername,
          );
          savedEmployee = {
            ...savedEmployee,
            username: account.username ?? requestedUsername,
          };
        }
      } else if (values.createAccount && canManageEmployeeAccount) {
        const account = await createEmployeeAccount(
          tenantId,
          savedEmployee.id,
          values.accountUsername,
          values.initialPassword,
        );
        savedEmployee = {
          ...savedEmployee,
          userId: account.user_id,
          username: account.username ?? values.accountUsername,
          accountLinked: true,
        };
      }

      await saveEmployeeCustomFieldValues(
        tenantId,
        savedEmployee.id,
        values.customFields,
      );

      if (savedEmployee.userId) {
        await saveEmployeeAccess(
          tenantId,
          savedEmployee.id,
          canManageEmployeeRoles ? values.roleIds : null,
          canManageCustomerAssignments ? assignments : null,
        );
      }

      return savedEmployee;
    },
    onSuccess: async () => {
      toast.success('Đã cập nhật nhân viên.');
      setEmployeeImageFile(null);
      setCustomerAssignments([]);
      onOpenChange(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', 'employees'] }),
        queryClient.invalidateQueries({ queryKey: ['project', 'customers'] }),
      ]);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function handleSubmit(values: EmployeeFormValues) {
    const missingField = (employeeCustomFieldsQuery.data ?? [])
      .filter((field) => field.isActive && field.isRequired)
      .find((field) => !values.customFields[field.key]?.trim());

    if (missingField) {
      form.setError(`customFields.${missingField.key}` as never, {
        type: 'required',
        message: `Vui lòng nhập ${missingField.label}.`,
      });
      return;
    }

    saveMutation.mutate({ values, assignments: customerAssignments });
  }

  function openEmployeeCustomFieldConfiguration() {
    window.open(
      `${ROUTES.PROJECT.DATA_CONFIGURATION}?entity=employee`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  return (
    <EmployeeFormDialog
      open={open}
      onOpenChange={onOpenChange}
      mode="edit"
      form={form}
      onSubmit={handleSubmit}
      onImageUrlFileChange={setEmployeeImageFile}
      customFields={employeeCustomFieldsQuery.data ?? []}
      onAddCustomField={openEmployeeCustomFieldConfiguration}
      onReloadCustomFields={() => void employeeCustomFieldsQuery.refetch()}
      isReloadingCustomFields={employeeCustomFieldsQuery.isFetching}
      isSaving={saveMutation.isPending}
      title={
        <>
          Sửa nhân viên:{' '}
          <span className="font-semibold text-primary">
            {employee.displayName}
          </span>
        </>
      }
      roleOptions={employeeAccess.roleOptions}
      customerOptions={employeeAccess.customers}
      customerTable={employeeAccess.customerTable}
      customerAssignments={customerAssignments}
      onCustomerAssignmentsChange={setCustomerAssignments}
      canManageRoles={canManageEmployeeRoles}
      canManageAccount={canManageEmployeeAccount}
      canManageCustomerAssignments={canManageCustomerAssignments}
      employeeHasLinkedAccount={Boolean(employee.userId)}
      accessIsLoading={employeeAccess.isLoading}
      accessError={employeeAccess.error}
    />
  );
}
