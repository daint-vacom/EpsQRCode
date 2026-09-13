import {
  forwardRef,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type Ref,
} from 'react';
import { autocomplete, useCombobox } from '@szhsin/react-autocomplete';
import { Hint, type IHintOption } from 'react-autocomplete-hint';
import { searchMatch } from '@/lib/search';
import { cn } from '@/lib/utils';
import type { BadgeProps } from '@/components/ui/badge';
import { inputVariants } from '@/components/ui/input';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';

export interface AutocompleteOption {
  value: string;
  label: string;
  status?: {
    label: string;
    variant?: BadgeProps['variant'];
    appearance?: BadgeProps['appearance'];
  };
}

export interface AutocompleteInputProps extends Omit<
  ComponentProps<'input'>,
  'value' | 'onChange'
> {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  onOptionSelect?: (option: AutocompleteOption) => void;
  emptyMessage?: string;
}

const statusClasses: Record<string, string> = {
  primary:
    'bg-primary-soft text-primary dark:bg-primary-soft dark:text-primary',
  secondary: 'bg-secondary text-secondary-foreground',
  success:
    'bg-[var(--color-success-soft,var(--color-green-100))] text-[var(--color-success-accent,var(--color-green-800))]',
  warning:
    'bg-[var(--color-warning-soft,var(--color-yellow-100))] text-[var(--color-warning-accent,var(--color-yellow-700))]',
  info: 'bg-[var(--color-info-soft,var(--color-violet-100))] text-[var(--color-info-accent,var(--color-violet-700))]',
  destructive:
    'bg-[var(--color-destructive-soft,var(--color-red-50))] text-[var(--color-destructive-accent,var(--color-red-700))]',
  outline: 'border border-border bg-transparent text-secondary-foreground',
};

function getStatusMarkup(option: AutocompleteOption) {
  if (!option.status) return null;

  const variant = option.status.variant ?? 'secondary';
  const appearance = option.status.appearance ?? 'default';

  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center whitespace-nowrap rounded-sm border border-transparent px-[0.325rem] py-0.5 text-[0.6875rem] font-medium leading-[0.75rem]',
        statusClasses[variant] ?? statusClasses.secondary,
        appearance === 'ghost' && 'border-transparent bg-transparent',
      )}
    >
      {option.status.label}
    </span>
  );
}

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export const AutocompleteInput = forwardRef<
  HTMLInputElement,
  AutocompleteInputProps
>(function AutocompleteInput(
  {
    value,
    onChange,
    options,
    onOptionSelect,
    emptyMessage: _emptyMessage,
    className,
    onBlur,
    onFocus,
    onKeyDown,
    onKeyUp,
    onClick,
    variant,
    background,
    warning = false,
    ...inputAttributes
  },
  ref,
) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const displayValue = selected?.label ?? value;
  const visibleOptions = useMemo(
    () =>
      displayValue
        ? options.filter((option) => searchMatch(option.label, displayValue))
        : options,
    [displayValue, options],
  );
  const hintOptions = useMemo<IHintOption[]>(
    () =>
      visibleOptions.map((option) => ({
        id: option.value,
        label: option.label,
      })),
    [visibleOptions],
  );

  function handleValueChange(nextValue?: string) {
    const nextLabel = nextValue ?? '';
    const selectedOption = options.find((option) => option.label === nextLabel);
    onChange(selectedOption?.value ?? nextLabel);
  }

  const {
    getInputProps,
    getListProps,
    getItemProps,
    open,
    setOpen,
    focusIndex,
    inputRef,
  } = useCombobox<AutocompleteOption>({
    value: displayValue,
    onChange: handleValueChange,
    selected,
    onSelectChange: (option) => {
      if (option) onOptionSelect?.(option);
    },
    items: visibleOptions,
    getItemValue: (option) => option.label,
    feature: autocomplete({ rovingText: false }),
  });

  const inputProps = getInputProps();
  const { ref: _comboboxRef, ...inputPropsWithoutRef } = inputProps;
  const isOpen = open && visibleOptions.length > 0;

  useLayoutEffect(() => {
    const input = anchorRef.current?.querySelector<HTMLInputElement>(
      'input[data-slot="input"]',
    );
    if (!input) return;

    inputRef.current = input;
    assignRef(ref, input);

    const hintWrapper =
      anchorRef.current?.querySelector<HTMLElement>('.rah-hint-wrapper');
    const hintInput =
      anchorRef.current?.querySelector<HTMLInputElement>('input.rah-hint');
    const hintFiller =
      anchorRef.current?.querySelector<HTMLElement>('.rah-text-filler');
    if (hintWrapper && hintInput && hintFiller) {
      const inputStyles = getComputedStyle(input);
      const typographyProperties = [
        'font-family',
        'font-size',
        'font-weight',
        'font-style',
        'letter-spacing',
        'line-height',
        'text-indent',
        'text-transform',
        'word-spacing',
        'font-kerning',
        'font-feature-settings',
        'font-variation-settings',
      ];

      for (const property of typographyProperties) {
        const value = inputStyles.getPropertyValue(property);
        hintWrapper.style.setProperty(property, value, 'important');
        hintInput.style.setProperty(property, value, 'important');
        hintFiller.style.setProperty(property, value, 'important');
      }
    }

    return () => {
      if (inputRef.current === input) inputRef.current = null;
      assignRef(ref, null);
    };
  }, [background, className, inputRef, ref, variant, warning]);

  function handleHintFill(valueToFill: string | IHintOption) {
    const label =
      typeof valueToFill === 'string' ? valueToFill : valueToFill.label;
    const option = options.find((item) => item.label === label);

    if (option) {
      onChange(option.value);
      onOptionSelect?.(option);
      setOpen(false);
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative w-full">
          <Hint
            options={hintOptions}
            allowEnterFill={false}
            allowTabFill={false}
            onFill={handleHintFill}
          >
            <input
              {...inputAttributes}
              {...inputPropsWithoutRef}
              data-slot="input"
              value={inputProps.value}
              aria-expanded={isOpen}
              className={cn(
                inputVariants({ variant, background }),
                warning &&
                  'border-[var(--color-warning-accent,var(--color-yellow-500))] focus-visible:border-[var(--color-warning-accent,var(--color-yellow-500))] focus-visible:ring-[var(--color-warning-accent,var(--color-yellow-500))]/30',
                className,
              )}
              onBlur={(event) => {
                inputProps.onBlur?.(event);
                const matchedOption = options.find(
                  (option) => option.label === event.currentTarget.value,
                );
                if (matchedOption && matchedOption.value !== value) {
                  onOptionSelect?.(matchedOption);
                }
                onBlur?.(event);
              }}
              onClick={(event) => {
                inputProps.onClick?.(event);
                onClick?.(event);
              }}
              onFocus={(event) => {
                inputProps.onFocus?.(event);
                onFocus?.(event);
              }}
              onKeyDown={(event) => {
                onKeyDown?.(event);
                if (event.defaultPrevented) return;

                if (
                  event.key === 'Enter' &&
                  isOpen &&
                  visibleOptions.length > 0 &&
                  focusIndex < 0
                ) {
                  event.preventDefault();
                  const option = visibleOptions[0];
                  onChange(option.value);
                  onOptionSelect?.(option);
                  setOpen(false);
                  return;
                }

                inputProps.onKeyDown?.(event);
              }}
              onKeyUp={(event) => {
                inputProps.onKeyUp?.(event);
                onKeyUp?.(event);
              }}
            />
          </Hint>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-[260px] p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          const target = event.target;
          if (target instanceof Node && anchorRef.current?.contains(target)) {
            event.preventDefault();
          }
        }}
      >
        <div {...getListProps()} className="max-h-60 overflow-y-auto">
          {visibleOptions.map((option, index) => (
            <div
              key={option.value}
              {...getItemProps({ item: option, index })}
              className={cn(
                'flex min-h-9 min-w-0 cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-[0.8125rem] leading-(--text-sm--line-height) text-foreground outline-none',
                index === focusIndex && 'bg-accent text-accent-foreground',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {getStatusMarkup(option)}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});
