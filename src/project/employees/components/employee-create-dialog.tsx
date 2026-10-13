import { useEffect, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import {
  createEmployee,
  createEmployeeAccount,
  loadEmployeeCustomFields,
  saveEmployeeAccess,
  saveEmployeeCustomFieldValues,
  updateEmployee,
  uploadEmployeeAvatar,
} from '../api/employees.api';
import {
  EmployeeFormDialog,
  useEmployeeForm,
} from '../forms/employee-form.generated';
import { useEmployeeAccessWorkspace } from '../hooks/use-employee-access-workspace';
import { emptyEmployeeForm, type EmployeeFormValues } from '../model/employee';

interface EmployeeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeCreateDialog({
  open,
  onOpenChange,
}: EmployeeCreateDialogProps) {
  const { hasPermission } = useUser();
  const queryClient = useQueryClient();
  const form = useEmployeeForm();
  const [employeeImageFile, setEmployeeImageFile] = useState<File | null>(null);
  const employeeAccess = useEmployeeAccessWorkspace({
    enabled: open,
  });
  const canManageEmployeeRoles = hasPermission(
    'organization:employee:assign-role',
  );
  const canManageEmployeeAccount = hasPermission(
    'organization:employee:update',
  );
  useEffect(() => {
    if (!open) return;

    form.reset({ ...emptyEmployeeForm, createAccount: true });
    setEmployeeImageFile(null);
  }, [form, open]);

  const employeeCustomFieldsQuery = useQuery({
    queryKey: ['project', 'employees', 'custom-fields'],
    queryFn: () => loadEmployeeCustomFields(),
    staleTime: 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ values }: { values: EmployeeFormValues }) => {
      if (!canManageEmployeeAccount) {
        throw new Error(
          'Bạn không có quyền tạo tài khoản đăng nhập cho nhân viên.',
        );
      }

      let savedEmployee = await createEmployee(values);
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
      toast.success('Đã tạo nhân viên.');
      form.reset(emptyEmployeeForm);
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

    saveMutation.mutate({ values: { ...values, createAccount: true } });
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
      mode="create"
      form={form}
      onSubmit={handleSubmit}
      onImageUrlFileChange={setEmployeeImageFile}
      customFields={employeeCustomFieldsQuery.data ?? []}
      onAddCustomField={openEmployeeCustomFieldConfiguration}
      onReloadCustomFields={() => {
        void employeeCustomFieldsQuery.refetch();
      }}
      isReloadingCustomFields={employeeCustomFieldsQuery.isFetching}
      isSaving={saveMutation.isPending}
      title="Thêm nhân viên"
      roleOptions={employeeAccess.roleOptions}
      canManageRoles={canManageEmployeeRoles}
      canManageAccount={canManageEmployeeAccount}
      employeeHasLinkedAccount={false}
    />
  );
}
