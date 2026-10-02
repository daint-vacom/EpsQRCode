import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  AvatarIdentityTooltip,
  getAvatarInitials,
} from '@/components/common/avatar-identity';
import {
  GradientAvatar,
  IDENTITY_AVATAR_TONES,
  type GradientAvatarTone,
} from '@/components/common/gradient-avatar';
import { OptionSelect, type OptionSelectProps } from './option-select';
import type { SelectOption } from './select-option';

export type SelectWithAvatarSize = 'md' | 'lg';
export type SelectWithAvatarVariant = 'ghost' | 'normal';

export interface SelectWithAvatarOption<T = unknown> extends Omit<
  SelectOption<T>,
  'label'
> {
  label: string;
  code?: string;
  avatarUrl?: string | null;
  avatarFallback?: string;
  avatarTone?: GradientAvatarTone;
  avatarClassName?: string;
  avatarStatusRingClassName?: string;
  avatarFallbackClassName?: string;
}

export interface SelectWithAvatarProps<T = unknown> extends Omit<
  OptionSelectProps<T>,
  | 'options'
  | 'selectedOption'
  | 'renderOption'
  | 'triggerContent'
  | 'optionContentClassName'
  | 'size'
  | 'className'
> {
  options: ReadonlyArray<SelectWithAvatarOption<T>>;
  selectedOption?: SelectWithAvatarOption<T>;
  size?: SelectWithAvatarSize;
  variant?: SelectWithAvatarVariant;
  className?: string;
}

interface SelectWithAvatarIdentityProps<T> {
  option: SelectWithAvatarOption<T>;
  size: SelectWithAvatarSize;
}

function SelectWithAvatarIdentity<T>({
  option,
  size,
}: SelectWithAvatarIdentityProps<T>): ReactNode {
  const isLarge = size === 'lg';
  const fallback = option.avatarFallback ?? getAvatarInitials(option.label);

  return (
    <AvatarIdentityTooltip name={option.label} code={option.code}>
      <span
        className={cn('flex min-w-0 items-center', isLarge ? 'gap-3' : 'gap-2')}
      >
        <GradientAvatar
          src={option.avatarUrl}
          alt={option.label}
          fallback={fallback}
          tone={option.avatarTone ?? IDENTITY_AVATAR_TONES.employee}
          statusRingClassName={option.avatarStatusRingClassName}
          fallbackClassName={option.avatarFallbackClassName}
          className={cn(
            isLarge
              ? 'size-9 rounded-lg text-sm'
              : 'size-6 rounded-lg text-[10px]',
            option.avatarClassName,
          )}
        />
        <span className="min-w-0 flex-1 truncate text-start">
          <span
            className={cn(
              'block truncate',
              isLarge
                ? 'text-sm font-semibold leading-5'
                : 'text-sm font-medium',
            )}
          >
            {option.label}
          </span>
          {isLarge && option.code ? (
            <span className="block truncate text-xs leading-4 text-muted-foreground">
              {option.code}
            </span>
          ) : null}
        </span>
      </span>
    </AvatarIdentityTooltip>
  );
}

export function SelectWithAvatar<T>({
  size = 'md',
  variant = 'normal',
  className,
  ...props
}: SelectWithAvatarProps<T>) {
  const variantClassName =
    variant === 'ghost'
      ? 'border-transparent bg-transparent shadow-none hover:bg-accent data-[state=open]:bg-accent'
      : undefined;
  const sizeClassName = size === 'lg' ? 'h-auto min-h-14 py-2' : undefined;

  return (
    <OptionSelect<T>
      {...props}
      size={size}
      optionContentClassName="overflow-visible"
      className={cn(variantClassName, sizeClassName, className)}
      renderOption={(option) => (
        <SelectWithAvatarIdentity
          option={option as SelectWithAvatarOption<T>}
          size="lg"
        />
      )}
      triggerContent={(option) =>
        option ? (
          <SelectWithAvatarIdentity
            option={option as SelectWithAvatarOption<T>}
            size={size}
          />
        ) : undefined
      }
    />
  );
}
