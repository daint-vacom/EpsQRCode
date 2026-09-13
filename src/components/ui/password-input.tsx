import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Input, InputGroup } from './input';

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
    <InputGroup className={containerClassName}>
      <Input
        {...props}
        className={cn('rounded-e-none', className)}
        disabled={disabled}
        type={isVisible ? 'text' : 'password'}
      />
      <Button
        type="button"
        variant="outline"
        mode="icon"
        size="md"
        className="rounded-s-none border-s-0"
        aria-label={isVisible ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
        disabled={disabled}
        onClick={() => setIsVisible((visible) => !visible)}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {isVisible ? <EyeOff /> : <Eye />}
      </Button>
    </InputGroup>
  );
}

export { PasswordInput };
