import { AvatarIdentity } from '@/components/common/avatar-identity';
import { IDENTITY_AVATAR_TONES } from '@/components/common/gradient-avatar';
import type { Customer } from '../model/customer';
import { getCustomerAvatarStatusRingClassName } from './customer-avatar';

export type CustomerIdentityData = Pick<
  Customer,
  'name' | 'customerCode' | 'imageUrl' | 'status'
>;

export function CustomerIdentity({
  customer,
  className,
}: {
  customer: CustomerIdentityData;
  className?: string;
}) {
  return (
    <AvatarIdentity
      name={customer.name}
      code={customer.customerCode}
      avatarUrl={customer.imageUrl}
      tone={IDENTITY_AVATAR_TONES.customer}
      avatarClassName="rounded-full"
      statusRingClassName={getCustomerAvatarStatusRingClassName(
        customer.status,
        'small',
      )}
      className={className}
    />
  );
}
