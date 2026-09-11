import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type FormSectionProps = Omit<React.HTMLAttributes<HTMLElement>, 'title'> & {
  heading: React.ReactNode;
  icon?: LucideIcon;
};

function FormSection({
  children,
  className,
  heading,
  icon: Icon,
  ...props
}: FormSectionProps) {
  return (
    <section
      data-slot="form-section"
      className={cn('space-y-4', className)}
      {...props}
    >
      <h3
        data-slot="form-section-heading"
        className="flex items-center gap-2 text-base font-semibold text-foreground"
      >
        {Icon ? (
          <span
            data-slot="form-section-icon"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-admin-blue-bg text-admin-blue-primary"
            aria-hidden="true"
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
        <span>{heading}</span>
      </h3>
      {children}
    </section>
  );
}

export { FormSection };
