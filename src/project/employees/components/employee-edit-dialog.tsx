import { useEffect, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
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
  const { hasPermission } = useUser();
  const queryClient = useQueryClient();
  const form = useEmployeeForm();
  const [employeeImageFile, setEmployeeImageFile] = useState<File | null>(null);
  const canManageEmployeeRoles = hasPermission(
    'organization:employee:assign-role',
  );
  const canManageEmployeeAccount = hasPermission(
    'organization:employee:update',
  );
  const employeeAccess = useEmployeeAccessWorkspace({
    enabled: open,
  });

  const employeeCustomFieldsQuery = useQuery({
    queryKey: ['project', 'employees', 'custom-fields'],
    queryFn: () => loadEmployeeCustomFields(),
    staleTime: 60 * 1000,
  });
  const employeeCustomDataQuery = useQuery({
    queryKey: ['project', 'employees', 'custom-data', employee.id],
    queryFn: () => loadEmployeeCustomFieldValues(employee.id),
    enabled: open,
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
  }, [employee.id, open]);

  const saveMutation = useMutation({
    mutationFn: async ({ values }: { values: EmployeeFormValues }) => {
      let savedEmployee = await updateEmployee(employee.id, values);

      if (employeeImageFile) {
        const imageUrl = await uploadEmployeeAvatar(
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
        savedEmployee.id,
        values.customFields,
      );

      if (savedEmployee.userId) {
        await saveEmployeeAccess(
          savedEmployee.id,
          canManageEmployeeRoles ? values.roleIds : null,
        );
      }

      return savedEmployee;
    },
    onSuccess: async () => {
      toast.success('Đã cập nhật nhân viên.');
      setEmployeeImageFile(null);
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: ['project', 'employees'],
      });
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

    saveMutation.mutate({ values });
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
      canManageRoles={canManageEmployeeRoles}
      canManageAccount={canManageEmployeeAccount}
      employeeHasLinkedAccount={Boolean(employee.userId)}
    />
  );
}
