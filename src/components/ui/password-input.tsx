import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Input } from './input';

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, 'type'> & {
  containerClassName?: string;
};

function PasswordInput({
  className,
  containerClassName,
  disabled,
  ...props
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <div className={cn('group relative w-full', containerClassName)}>
      <Input
        {...props}
        className={cn('pe-10', className)}
        data-hide-native-password-reveal
        disabled={disabled}
        type={isVisible ? 'text' : 'password'}
      />
      <Button
        type="button"
        variant="ghost"
        mode="icon"
        size="icon"
        className="pointer-events-none absolute end-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground opacity-0 focus-visible:ring-0 focus-visible:ring-offset-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        aria-label={isVisible ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
        aria-pressed={isVisible}
        disabled={disabled}
        onClick={() => setIsVisible((visible) => !visible)}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {isVisible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}

export { PasswordInput };
