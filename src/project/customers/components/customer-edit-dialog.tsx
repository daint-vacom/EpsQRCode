import { useEffect, useState } from 'react';
import { replaceSubjectTags } from '@/project/tags/api/tags.api';
import { useSubjectTagFilter } from '@/project/tags/hooks/use-subject-tag-filter';
import { CUSTOMER_TAG_GROUP_CODE } from '@/project/tags/model/tag';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import {
  loadCustomerCustomFields,
  loadCustomerCustomFieldValues,
  loadCustomerRegionOptions,
  saveCustomerCustomFieldValues,
  updateCustomer,
  uploadCustomerImage,
} from '../api/customers.api';
import {
  CustomerFormDialog,
  useCustomerForm,
} from '../forms/customer-form.generated';
import {
  mapCustomerToFormValues,
  type Customer,
  type CustomerFormValues,
} from '../model/customer';

interface CustomerEditDialogProps {
  customer: Customer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCustomField?: () => void;
}

export function CustomerEditDialog({
  customer,
  open,
  onOpenChange,
  onAddCustomField,
}: CustomerEditDialogProps) {
  const queryClient = useQueryClient();
  const [customerImageFile, setCustomerImageFile] = useState<File | null>(null);
  const form = useCustomerForm();
  const customerRegionQuery = useQuery({
    queryKey: ['project', 'customers', 'regions'],
    queryFn: loadCustomerRegionOptions,
  });
  const customerCustomFieldsQuery = useQuery({
    queryKey: ['project', 'customers', 'custom-fields', customer.tenantId],
    queryFn: () => loadCustomerCustomFields(customer.tenantId),
    enabled: Boolean(open),
    staleTime: 60 * 1000,
  });
  const customerCustomDataQuery = useQuery({
    queryKey: [
      'project',
      'customers',
      'custom-data',
      customer.tenantId,
      customer.id,
    ],
    queryFn: () =>
      loadCustomerCustomFieldValues(customer.tenantId, customer.id),
    enabled: Boolean(open),
  });
  const customerTagFilterQuery = useSubjectTagFilter('customer', {
    moduleCodes: [CUSTOMER_TAG_GROUP_CODE],
    allowCustomGroups: false,
  });

  useEffect(() => {
    if (
      !open ||
      customerCustomDataQuery.isLoading ||
      customerTagFilterQuery.isLoading
    ) {
      return;
    }

    const customerGroupTagIds =
      customerTagFilterQuery.data?.tagsBySubjectId[customer.id]
        ?.filter((tag) => tag.moduleCode === CUSTOMER_TAG_GROUP_CODE)
        .map((tag) => tag.id) ?? [];

    form.reset({
      ...mapCustomerToFormValues(customer),
      customFields: customerCustomDataQuery.data ?? {},
      customerGroupTagIds,
    });
    setCustomerImageFile(null);
  }, [
    customer,
    customerCustomDataQuery.data,
    customerCustomDataQuery.isLoading,
    customerTagFilterQuery.data,
    customerTagFilterQuery.isLoading,
    form,
    open,
  ]);

  const saveMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      const imageUrl = customerImageFile
        ? await uploadCustomerImage(
            customer.tenantId,
            customer.id,
            customerImageFile,
          )
        : values.imageUrl;

      const savedCustomer = await updateCustomer(customer.id, {
        ...values,
        imageUrl,
      });
      await replaceSubjectTags(
        customer.tenantId,
        savedCustomer.id,
        'customer',
        values.customerGroupTagIds,
      );
      await saveCustomerCustomFieldValues(
        customer.tenantId,
        customer.id,
        values.customFields,
      );
      return savedCustomer;
    },
    onSuccess: async () => {
      toast.success('Đã cập nhật khách hàng.');
      setCustomerImageFile(null);
      await queryClient.invalidateQueries({
        queryKey: ['project', 'customers'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['project', 'tags', 'subject-filter'],
      });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function handleSubmit(values: CustomerFormValues) {
    const missingField = (customerCustomFieldsQuery.data ?? [])
      .filter((customField) => customField.isActive && customField.isRequired)
      .find((customField) => !values.customFields[customField.key]?.trim());

    if (missingField) {
      form.setError(`customFields.${missingField.key}` as never, {
        type: 'required',
        message: `Vui lòng nhập ${missingField.label}.`,
      });
      return;
    }

    saveMutation.mutate(values);
  }

  return (
    <CustomerFormDialog
      open={open}
      onOpenChange={onOpenChange}
      mode="edit"
      form={form}
      onSubmit={handleSubmit}
      onImageUrlFileChange={setCustomerImageFile}
      regionCodeOptions={customerRegionQuery.data ?? []}
      customFields={customerCustomFieldsQuery.data ?? []}
      onAddCustomField={onAddCustomField}
      onReloadCustomFields={() => {
        void customerCustomFieldsQuery.refetch();
      }}
      isReloadingCustomFields={customerCustomFieldsQuery.isFetching}
      isSaving={saveMutation.isPending}
      title="Sửa khách hàng"
    />
  );
}
