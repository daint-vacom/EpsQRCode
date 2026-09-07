import { ImageAvatar } from '@/components/ui/image-avatar';
import { getAvatarInitials } from '@/components/common/avatar-identity';
import {
  GradientAvatar,
  IDENTITY_AVATAR_TONES,
} from '@/components/common/gradient-avatar';
import type { Customer } from '../model/customer';

type CustomerAvatarData = Pick<Customer, 'name' | 'imageUrl'>;

export function getCustomerInitials(customer: CustomerAvatarData) {
  return getAvatarInitials(customer.name);
}

export function CustomerAvatar({
  customer,
  className,
}: {
  customer: Pick<Customer, 'name' | 'imageUrl'>;
  className?: string;
}) {
  const fallback = getCustomerInitials(customer);

  return customer.imageUrl ? (
    <ImageAvatar
      src={customer.imageUrl}
      alt={customer.name}
      fallback={fallback}
      fallbackTone={IDENTITY_AVATAR_TONES.customer}
      className={className}
    />
  ) : (
    <GradientAvatar
      fallback={fallback}
      tone={IDENTITY_AVATAR_TONES.customer}
      className={className}
    />
  );
}
