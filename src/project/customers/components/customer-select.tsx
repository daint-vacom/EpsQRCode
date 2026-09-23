import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import {
  SelectWithAvatar,
  type SelectWithAvatarOption,
  type SelectWithAvatarProps,
} from '@/components/ui/select-with-avatar';
import { IDENTITY_AVATAR_TONES } from '@/components/common/gradient-avatar';
import {
  loadCustomerSelectOptions,
  type CustomerSelectOption,
} from '../api/customers.api';

export type { CustomerSelectOption } from '../api/customers.api';

export interface CustomerSelectProps extends Omit<
  SelectWithAvatarProps<CustomerSelectOption>,
  'options' | 'loading' | 'loadingMessage' | 'onSelect' | 'selectedOption'
> {
  selectedCustomer?: CustomerSelectOption;
  onSelect?: (customer: CustomerSelectOption | undefined) => void;
}

function toOption(
  customer: CustomerSelectOption,
): SelectWithAvatarOption<CustomerSelectOption> {
  return {
    value: customer.id,
    label: customer.name,
    code: customer.customerCode,
    avatarUrl: customer.imageUrl,
    avatarTone: IDENTITY_AVATAR_TONES.customer,
    searchableText: `${customer.name} ${customer.customerCode}`,
    data: customer,
  };
}

export function CustomerSelect({
  value = '',
  selectedCustomer,
  placeholder = 'Chọn khách hàng',
  searchPlaceholder = 'Tìm khách hàng...',
  emptyMessage = 'Không tìm thấy khách hàng',
  disabled = false,
  size = 'md',
  variant = 'normal',
  className,
  onSelect,
  ...props
}: CustomerSelectProps) {
  const { userId } = useUser();
  const { tenantId } = useTenant();
  const query = useQuery({
    queryKey: ['project', 'customers', 'select-options', userId, tenantId],
    queryFn: () => {
      if (!userId || !tenantId) {
        throw new Error('Chưa xác định tổ chức hiện tại.');
      }
      return loadCustomerSelectOptions(userId, tenantId);
    },
    enabled: Boolean(userId && tenantId),
    staleTime: 5 * 60 * 1000,
  });

  const options = useMemo(() => (query.data ?? []).map(toOption), [query.data]);
  const selectedOption = selectedCustomer
    ? toOption(selectedCustomer)
    : undefined;

  return (
    <SelectWithAvatar
      {...props}
      value={value}
      options={options}
      selectedOption={selectedOption}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={
        query.isError ? getApiErrorMessage(query.error) : emptyMessage
      }
      loading={query.isPending}
      loadingMessage="Đang tải danh sách khách hàng..."
      disabled={disabled || !userId || !tenantId}
      size={size}
      variant={variant}
      className={className}
      onSelect={(option) => onSelect?.(option?.data)}
    />
  );
}
