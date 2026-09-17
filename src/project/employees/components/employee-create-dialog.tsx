import { useEffect, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import {
  createEmployee,
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
import type { EmployeeCustomerAssignmentInput } from '../model/employee-responsibility';

interface EmployeeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeCreateDialog({
  open,
  onOpenChange,
}: EmployeeCreateDialogProps) {
  const { tenantId } = useTenant();
  const { hasPermission } = useUser();
  const queryClient = useQueryClient();
  const form = useEmployeeForm();
  const [employeeImageFile, setEmployeeImageFile] = useState<File | null>(null);
  const [customerAssignments, setCustomerAssignments] = useState<
    EmployeeCustomerAssignmentInput[]
  >([]);
  const employeeAccess = useEmployeeAccessWorkspace({
    tenantId,
    enabled: open,
  });
  const canManageEmployeeRoles = hasPermission(
    'organization:employee:assign-role',
  );
  const canManageCustomerAssignments = hasPermission('customers:update');

  useEffect(() => {
    if (!open) return;

    form.reset(emptyEmployeeForm);
    setEmployeeImageFile(null);
    setCustomerAssignments([]);
  }, [form, open]);

  const employeeCustomFieldsQuery = useQuery({
    queryKey: ['project', 'employees', 'custom-fields', tenantId],
    queryFn: () => loadEmployeeCustomFields(tenantId!),
    enabled: Boolean(tenantId),
    staleTime: 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      values,
      assignments,
    }: {
      values: EmployeeFormValues;
      assignments: EmployeeCustomerAssignmentInput[];
    }) => {
      if (!tenantId) throw new Error('Chưa xác định tenant.');

      let savedEmployee = await createEmployee(tenantId, values);
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
      toast.success('Đã tạo nhân viên.');
      form.reset(emptyEmployeeForm);
      setEmployeeImageFile(null);
      setCustomerAssignments([]);
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
      customerOptions={employeeAccess.customers}
      customerTable={employeeAccess.customerTable}
      customerAssignments={customerAssignments}
      onCustomerAssignmentsChange={setCustomerAssignments}
      canManageRoles={canManageEmployeeRoles}
      canManageCustomerAssignments={canManageCustomerAssignments}
      employeeHasLinkedAccount={false}
      accessIsLoading={employeeAccess.isLoading}
      accessError={employeeAccess.error}
    />
  );
}
