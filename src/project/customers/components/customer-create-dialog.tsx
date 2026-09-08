import { useEffect, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import {
  createCustomer,
  loadCustomerCustomFields,
  loadCustomerRegionOptions,
  saveCustomerCustomFieldValues,
  updateCustomer,
  uploadCustomerImage,
} from '../api/customers.api';
import {
  CustomerFormDialog,
  useCustomerForm,
} from '../forms/customer-form.generated';
import { emptyCustomerForm, type CustomerFormValues } from '../model/customer';

interface CustomerCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerCreateDialog({
  open,
  onOpenChange,
}: CustomerCreateDialogProps) {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const form = useCustomerForm();
  const [customerImageFile, setCustomerImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;

    form.reset(emptyCustomerForm);
    setCustomerImageFile(null);
  }, [form, open]);

  const customerRegionQuery = useQuery({
    queryKey: ['project', 'customers', 'regions'],
    queryFn: loadCustomerRegionOptions,
  });
  const customerCustomFieldsQuery = useQuery({
    queryKey: ['project', 'customers', 'custom-fields', tenantId],
    queryFn: () => loadCustomerCustomFields(tenantId!),
    enabled: Boolean(tenantId),
    staleTime: 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      if (!tenantId) throw new Error('Chưa xác định tenant.');

      let savedCustomer = await createCustomer(tenantId, values);
      if (customerImageFile) {
        const imageUrl = await uploadCustomerImage(
          tenantId,
          savedCustomer.id,
          customerImageFile,
        );
        savedCustomer = await updateCustomer(savedCustomer.id, {
          ...values,
          imageUrl,
        });
      }

      await saveCustomerCustomFieldValues(
        tenantId,
        savedCustomer.id,
        values.customFields,
      );

      return savedCustomer;
    },
    onSuccess: async () => {
      toast.success('Đã tạo khách hàng.');
      form.reset(emptyCustomerForm);
      setCustomerImageFile(null);
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: ['project', 'customers'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function handleSubmit(values: CustomerFormValues) {
    const missingField = (customerCustomFieldsQuery.data ?? [])
      .filter((field) => field.isActive && field.isRequired)
      .find((field) => !values.customFields[field.key]?.trim());

    if (missingField) {
      form.setError(`customFields.${missingField.key}` as never, {
        type: 'required',
        message: `Vui lòng nhập ${missingField.label}.`,
      });
      return;
    }

    saveMutation.mutate(values);
  }

  function openCustomerCustomFieldConfiguration() {
    window.open(
      `${ROUTES.PROJECT.DATA_CONFIGURATION}?entity=customer`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  return (
    <CustomerFormDialog
      open={open}
      onOpenChange={onOpenChange}
      mode="create"
      form={form}
      onSubmit={handleSubmit}
      isSaving={saveMutation.isPending}
      title="Thêm khách hàng"
      regionCodeOptions={customerRegionQuery.data ?? []}
      onImageUrlFileChange={setCustomerImageFile}
      customFields={customerCustomFieldsQuery.data ?? []}
      onAddCustomField={openCustomerCustomFieldConfiguration}
      onReloadCustomFields={() => {
        void customerCustomFieldsQuery.refetch();
      }}
      isReloadingCustomFields={customerCustomFieldsQuery.isFetching}
    />
  );
}
