import { cn } from '@/lib/utils';
import { ImageAvatar } from '@/components/ui/image-avatar';
import { getAvatarInitials } from '@/components/common/avatar-identity';
import {
  GradientAvatar,
  IDENTITY_AVATAR_TONES,
} from '@/components/common/gradient-avatar';
import type { Customer, CustomerStatus } from '../model/customer';

export type CustomerAvatarRingSize = 'small' | 'large';

type CustomerAvatarData = Pick<Customer, 'name' | 'imageUrl'> &
  Partial<Pick<Customer, 'status'>>;

const CUSTOMER_STATUS_RING_TONE_CLASSES: Record<CustomerStatus, string> = {
  active: 'outline-admin-success-dot',
  inactive: 'outline-admin-red-light',
  uncontacted: 'outline-admin-neutral-500/60',
};

export function getCustomerAvatarStatusRingClassName(
  status: CustomerStatus | undefined,
  size: CustomerAvatarRingSize = 'small',
) {
  if (!status) return undefined;

  const sizeClasses = size === 'large' ? 'outline-4' : 'outline-2';

  return `${sizeClasses} ${CUSTOMER_STATUS_RING_TONE_CLASSES[status]}`;
}

export function getCustomerInitials(customer: CustomerAvatarData) {
  return getAvatarInitials(customer.name);
}

export function CustomerAvatar({
  customer,
  className,
  ringSize = 'small',
}: {
  customer: CustomerAvatarData;
  className?: string;
  ringSize?: CustomerAvatarRingSize;
}) {
  const fallback = getCustomerInitials(customer);
  const statusRingClassName = getCustomerAvatarStatusRingClassName(
    customer.status,
    ringSize,
  );
  const fallbackClassName = ringSize === 'large' ? 'text-2xl' : undefined;
  const avatarClassName = cn(className, 'rounded-full');

  return customer.imageUrl ? (
    <ImageAvatar
      src={customer.imageUrl}
      alt={customer.name}
      fallback={fallback}
      fallbackTone={IDENTITY_AVATAR_TONES.customer}
      className={avatarClassName}
      statusRingClassName={statusRingClassName}
      fallbackClassName={fallbackClassName}
    />
  ) : (
    <GradientAvatar
      fallback={fallback}
      tone={IDENTITY_AVATAR_TONES.customer}
      className={avatarClassName}
      statusRingClassName={statusRingClassName}
      fallbackClassName={fallbackClassName}
    />
  );
}
