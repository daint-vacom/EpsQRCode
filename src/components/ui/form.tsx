'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { Label as LabelPrimitive } from 'radix-ui';
import { Controller, FormProvider, useFormContext } from 'react-hook-form';
import type { ControllerProps, FieldPath, FieldValues } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
);

type FormLabelVariant = 'default' | 'compact';
type FormItemLayout = 'stacked' | 'horizontal';
type FormItemLabelWidth = 'sm' | 'md' | 'lg';
type FormItemLabelGap = 'sm' | 'md' | 'lg';

const formItemVariants = cva('', {
  variants: {
    layout: {
      stacked: 'flex flex-col',
      horizontal:
        '[--form-item-label-width:8.75rem] grid items-center grid-cols-[var(--form-item-label-width)_minmax(0,1fr)] gap-x-3 gap-y-1 [&>[data-slot=form-message]]:col-start-2 [&>[data-slot=form-description]]:col-start-2',
    },
    variant: {
      default: 'gap-2.5',
      compact: 'gap-1',
    },
    labelWidth: {
      sm: '[--form-item-label-width:7rem]',
      md: '[--form-item-label-width:8.75rem]',
      lg: '[--form-item-label-width:10.5rem]',
    },
    labelGap: {
      sm: 'gap-x-2',
      md: 'gap-x-3',
      lg: 'gap-x-4',
    },
  },
  defaultVariants: {
    layout: 'stacked',
    variant: 'default',
  },
  compoundVariants: [
    {
      layout: 'horizontal',
      className: 'gap-y-1',
    },
  ],
});

const formLabelVariants = cva('font-normal text-foreground', {
  variants: {
    variant: {
      default: '',
      compact: 'text-xs text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>');
  }

  const { id, variant: itemVariant } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    itemVariant,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
  variant: FormLabelVariant;
};

const FormItemContext = React.createContext<FormItemContextValue>({
  id: '',
  variant: 'default',
});

function FormItem({
  className,
  variant = 'default',
  layout = 'stacked',
  labelWidth,
  labelGap,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: FormLabelVariant;
  layout?: FormItemLayout;
  labelWidth?: FormItemLabelWidth;
  labelGap?: FormItemLabelGap;
}) {
  const id = React.useId();
  const { error } = useFormField();

  return (
    <FormItemContext.Provider value={{ id, variant }}>
      <div
        data-slot="form-item"
        className={cn(
          formItemVariants({ layout, variant, labelWidth, labelGap }),
          className,
        )}
        data-invalid={!!error}
        {...props}
      />
    </FormItemContext.Provider>
  );
}

function FormLabel({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> &
  VariantProps<typeof formLabelVariants>) {
  const { formItemId, itemVariant } = useFormField();

  return (
    <Label
      data-slot="form-label"
      className={cn(
        formLabelVariants({ variant: variant ?? itemVariant }),
        className,
      )}
      htmlFor={formItemId}
      {...props}
    />
  );
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return (
    <Slot
      data-slot="form-control"
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
}

function FormDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const { formDescriptionId, error } = useFormField();

  if (error) {
    return null; // Hide the description when there's an error
  }

  return (
    <div
      data-slot="form-description"
      id={formDescriptionId}
      className={cn('text-xs text-muted-foreground -mt-0.5', className)}
      {...props}
    />
  );
}

function FormMessage({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message) : children;

  if (!body) {
    return null;
  }

  return (
    <div
      data-slot="form-message"
      id={formMessageId}
      className={cn('-mt-0.5 text-xs font-normal text-destructive', className)}
      {...props}
    >
      {body}
    </div>
  );
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  formItemVariants,
  formLabelVariants,
  useFormField,
};

export type { FormItemLabelGap, FormItemLabelWidth, FormItemLayout };
