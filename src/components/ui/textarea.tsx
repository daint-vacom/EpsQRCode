'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Define input size variants
const textareaVariants = cva(
  `
    w-full bg-background focus-visible:bg-background border border-input text-foreground shadow-xs shadow-black/5 transition-[color,border-color,box-shadow,background-color] duration-200 ease-out
    text-foreground placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] 
    focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 [&[readonly]]:opacity-70 aria-invalid:border-destructive
    aria-invalid:border-destructive/60 aria-invalid:ring-destructive/10 dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/20
  `,
  {
    variants: {
      variant: {
        sm: 'px-2.5 py-2.5 text-xs rounded-md',
        md: 'px-3 py-3 text-[0.8125rem] leading-(--text-sm--line-height) rounded-md',
        lg: 'px-4 py-4 text-sm rounded-md',
      },
    },
    defaultVariants: {
      variant: 'md',
    },
  },
);

function Textarea({
  className,
  variant,
  autoResize = false,
  onInput,
  ref,
  ...props
}: React.ComponentProps<'textarea'> &
  VariantProps<typeof textareaVariants> & { autoResize?: boolean }) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const baseScrollHeightRef = React.useRef<number | null>(null);

  const resizeToContent = React.useCallback(
    (textarea: HTMLTextAreaElement | null = textareaRef.current) => {
      if (!textarea) return;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const computedStyle = window.getComputedStyle(textarea);
      const minHeight = Number.parseFloat(computedStyle.minHeight) || 0;
      const borderHeight =
        (Number.parseFloat(computedStyle.borderTopWidth) || 0) +
        (Number.parseFloat(computedStyle.borderBottomWidth) || 0);

      if (baseScrollHeightRef.current === null) {
        baseScrollHeightRef.current = scrollHeight;
      }

      const hasMultipleLines = scrollHeight > baseScrollHeightRef.current + 1;
      textarea.style.height = hasMultipleLines
        ? `${scrollHeight + borderHeight}px`
        : `${minHeight}px`;
    },
    [],
  );

  const setTextareaRef = React.useCallback(
    (textarea: HTMLTextAreaElement | null) => {
      textareaRef.current = textarea;
      if (typeof ref === 'function') ref(textarea);
      else if (ref) ref.current = textarea;
      if (autoResize) resizeToContent(textarea);
    },
    [autoResize, ref, resizeToContent],
  );

  React.useLayoutEffect(() => {
    if (autoResize) resizeToContent();
  }, [autoResize, props.value, props.defaultValue, resizeToContent]);

  return (
    <textarea
      data-slot="textarea"
      ref={setTextareaRef}
      className={cn(
        textareaVariants({ variant }),
        autoResize && 'resize-none',
        className,
      )}
      onInput={(event) => {
        onInput?.(event);
        if (autoResize) resizeToContent(event.currentTarget);
      }}
      {...props}
    />
  );
}

export { Textarea, textareaVariants };
