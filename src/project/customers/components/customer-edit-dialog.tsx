import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSoftwareAccountCatalogs } from '@/project/tags/api/software-account-catalog.api';
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
  loadCustomerSoftwareAccounts,
  replaceCustomerResponsibilities,
  replaceCustomerSoftwareAccounts,
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
import type { CustomerResponsibilityAssignmentInput } from '../model/customer-responsibility';

interface CustomerEditDialogProps {
  customer: Customer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCustomField?: () => void;
  canManageResponsibility?: boolean;
}

export function CustomerEditDialog({
  customer,
  open,
  onOpenChange,
  onAddCustomField,
  canManageResponsibility = false,
}: CustomerEditDialogProps) {
  const queryClient = useQueryClient();
  const [customerImageFile, setCustomerImageFile] = useState<File | null>(null);
  const [responsibilityAssignments, setResponsibilityAssignments] = useState<
    CustomerResponsibilityAssignmentInput[] | null
  >(null);
  const responsibilityAssignmentsRef = useRef<
    CustomerResponsibilityAssignmentInput[] | null
  >(null);
  const [responsibilityIsValid, setResponsibilityIsValid] = useState(true);
  const form = useCustomerForm();

  useEffect(() => {
    responsibilityAssignmentsRef.current = null;
    setResponsibilityAssignments(null);
    setResponsibilityIsValid(true);
  }, [customer.id, open]);

  const handleResponsibilityAssignmentsChange = useCallback(
    (assignments: CustomerResponsibilityAssignmentInput[]) => {
      responsibilityAssignmentsRef.current = assignments;
      setResponsibilityAssignments(assignments);
    },
    [],
  );
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
  const customerSoftwareAccountsQuery = useQuery({
    queryKey: [
      'project',
      'customers',
      'software-accounts',
      customer.tenantId,
      customer.id,
    ],
    queryFn: () => loadCustomerSoftwareAccounts(customer.id),
    enabled: Boolean(open),
  });
  const softwareAccountCatalogsQuery = useQuery({
    queryKey: [
      'project',
      'tags',
      'software-account-catalog',
      customer.tenantId,
      'all',
    ],
    queryFn: () => loadSoftwareAccountCatalogs(customer.tenantId, true),
    enabled: Boolean(open),
  });

  useEffect(() => {
    if (
      !open ||
      customerCustomDataQuery.isLoading ||
      customerTagFilterQuery.isLoading ||
      customerSoftwareAccountsQuery.isLoading
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
      softwareAccounts: customerSoftwareAccountsQuery.data ?? [],
    });
    setCustomerImageFile(null);
  }, [
    customer,
    customerCustomDataQuery.data,
    customerCustomDataQuery.isLoading,
    customerTagFilterQuery.data,
    customerTagFilterQuery.isLoading,
    customerSoftwareAccountsQuery.data,
    customerSoftwareAccountsQuery.isLoading,
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
      await replaceCustomerSoftwareAccounts(
        savedCustomer.id,
        values.softwareAccounts,
      );
      await replaceSubjectTags(
        customer.tenantId,
        'customer',
        savedCustomer.id,
        values.customerGroupTagIds,
      );
      await saveCustomerCustomFieldValues(
        customer.tenantId,
        customer.id,
        values.customFields,
      );
      const latestResponsibilityAssignments =
        responsibilityAssignmentsRef.current;
      if (canManageResponsibility && latestResponsibilityAssignments) {
        await replaceCustomerResponsibilities(
          customer.tenantId,
          savedCustomer.id,
          latestResponsibilityAssignments,
        );
      }
      return savedCustomer;
    },
    onSuccess: async () => {
      toast.success('Đã cập nhật khách hàng.');
      setCustomerImageFile(null);
      responsibilityAssignmentsRef.current = null;
      setResponsibilityAssignments(null);
      setResponsibilityIsValid(true);
      await queryClient.invalidateQueries({
        queryKey: [
          'project',
          'customers',
          'responsibility-workspace',
          customer.tenantId,
          customer.id,
        ],
        refetchType: 'all',
      });
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
      isSubmitDisabled={
        canManageResponsibility &&
        responsibilityAssignments !== null &&
        !responsibilityIsValid
      }
      customerResponsibility={{
        tenantId: customer.tenantId,
        customerId: customer.id,
        canManage: canManageResponsibility,
        isValid: responsibilityIsValid,
        draftAssignments: responsibilityAssignments,
        onAssignmentsChange: handleResponsibilityAssignmentsChange,
        onValidationChange: setResponsibilityIsValid,
      }}
      softwareAccountCatalogs={softwareAccountCatalogsQuery.data ?? []}
      title={
        <>
          Sửa khách hàng:{' '}
          <span className="font-semibold text-primary">{customer.name}</span>
        </>
      }
    />
  );
}
