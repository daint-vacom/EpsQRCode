import { useMemo, useState } from 'react';
import type { ReactNode, Ref, UIEventHandler } from 'react';
import { Check, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { searchMatch } from '@/lib/search';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ErrorState } from '@/components/ui/error-state';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { SelectOption } from '@/components/ui/select-option';

export type { SelectOption } from '@/components/ui/select-option';
export type SearchSelectOption<T = unknown> = SelectOption<T>;

export interface SelectSearchProps<T = unknown> {
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (option: SearchSelectOption<T> | undefined) => void;
  options: ReadonlyArray<SearchSelectOption<T>>;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  ariaLabel?: string;
  emptyMessage?: string;
  disabled?: boolean;
  manualFilter?: boolean;
  canDeselect?: boolean;
  loading?: boolean;
  loadingMessage?: string;
  loadingMore?: boolean;
  loadingMoreMessage?: string;
  onLoadMore?: () => void;
  loadMoreLabel?: string;
  errorMessage?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onOptionsScroll?: UIEventHandler<HTMLDivElement>;
  selectedOption?: SearchSelectOption<T>;
  renderOption?: (
    option: SearchSelectOption<T>,
    isSelected: boolean,
  ) => ReactNode;
  triggerContent?:
    ReactNode | ((option: SearchSelectOption<T> | undefined) => ReactNode);
  triggerContentClassName?: string;
  triggerMode?: 'full' | 'chevron';
  className?: string;
  optionContentClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'normal' | 'ghost';
  triggerRef?: Ref<HTMLButtonElement>;
  'aria-invalid'?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSearchChange?: (query: string) => void;
  searchValue?: string;
}

export function getSearchSelectOptionText<T>(
  option: SearchSelectOption<T>,
): string {
  if (option.searchableText !== undefined) {
    return option.searchableText;
  }

  return typeof option.label === 'string' ? option.label : option.value;
}

function getTriggerContent<T>({
  selectedOption,
  placeholder,
  triggerContent,
}: {
  selectedOption: SearchSelectOption<T> | undefined;
  placeholder: string;
  triggerContent: SelectSearchProps<T>['triggerContent'];
}): ReactNode {
  if (typeof triggerContent === 'function') {
    return triggerContent(selectedOption);
  }

  if (triggerContent !== undefined) {
    return triggerContent;
  }

  return selectedOption?.label ?? placeholder;
}

function groupOptions<T>(
  options: ReadonlyArray<SearchSelectOption<T>>,
): Array<[string, Array<SearchSelectOption<T>>]> {
  const groups = new Map<string, Array<SearchSelectOption<T>>>();

  options.forEach((option) => {
    const group = option.group ?? '';
    const groupOptions = groups.get(group) ?? [];
    groupOptions.push(option);
    groups.set(group, groupOptions);
  });

  return [...groups.entries()];
}

export function SelectSearch<T = unknown>({
  value = '',
  onChange,
  onSelect,
  options,
  placeholder = 'Chọn...',
  searchPlaceholder = 'Tìm...',
  searchable = true,
  ariaLabel,
  emptyMessage = 'Không có kết quả',
  disabled = false,
  manualFilter = false,
  canDeselect = true,
  loading = false,
  loadingMessage = 'Đang tải...',
  loadingMore = false,
  loadingMoreMessage = loadingMessage,
  onLoadMore,
  loadMoreLabel,
  errorMessage,
  onRetry,
  retryLabel,
  onOptionsScroll,
  selectedOption: selectedOptionProp,
  renderOption,
  triggerContent,
  triggerContentClassName,
  triggerMode = 'full',
  variant = 'normal',
  className,
  optionContentClassName,
  size = 'md',
  triggerRef,
  'aria-invalid': ariaInvalid,
  onOpenChange,
  onSearchChange,
  searchValue,
}: SelectSearchProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [localQuery, setQuery] = useState('');
  const query = searchValue ?? localQuery;

  const selectedOption = useMemo(() => {
    if (selectedOptionProp?.value === value) {
      return selectedOptionProp;
    }

    return options.find((option) => option.value === value);
  }, [options, selectedOptionProp, value]);

  const filteredOptions = useMemo(() => {
    if (!searchable || manualFilter) {
      return options;
    }

    return options.filter((option) =>
      searchMatch(getSearchSelectOptionText(option), query),
    );
  }, [manualFilter, options, query, searchable]);

  const groupedOptions = useMemo(
    () => groupOptions(filteredOptions),
    [filteredOptions],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    setIsOpen(nextOpen);
    onOpenChange?.(nextOpen);

    if (!nextOpen) {
      setQuery('');
      onSearchChange?.('');
    }
  };

  const handleSelect = (option: SearchSelectOption<T>) => {
    const isSameValue = option.value === value;

    if (isSameValue && !canDeselect) {
      return;
    }

    const nextValue = isSameValue ? '' : option.value;
    onChange?.(nextValue);
    onSelect?.(nextValue ? option : undefined);
    handleOpenChange(false);
  };

  const content = getTriggerContent({
    selectedOption,
    placeholder,
    triggerContent,
  });

  const triggerContentNode = (
    <span
      className={cn(
        'min-w-0 truncate text-start',
        triggerContentClassName,
        !selectedOption && triggerContent === undefined
          ? 'text-muted-foreground'
          : undefined,
      )}
    >
      {content}
    </span>
  );

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      {triggerMode === 'chevron' ? (
        <PopoverAnchor asChild>
          <div
            data-slot="select-trigger"
            className={cn(
              'inline-flex min-h-7 min-w-0 items-center gap-1 text-sm',
              className,
            )}
          >
            {triggerContentNode}
            <PopoverTrigger asChild>
              <Button
                ref={triggerRef}
                type="button"
                aria-expanded={isOpen}
                aria-label={ariaLabel ?? 'Mở lựa chọn'}
                aria-busy={loading}
                disabled={disabled}
                size="sm"
                aria-invalid={ariaInvalid}
                variant="ghost"
                mode="icon"
                className="size-6 shrink-0 rounded-md p-0 text-muted-foreground"
              >
                <ChevronDown className="size-3.5 transition-transform data-[state=open]:rotate-180" />
              </Button>
            </PopoverTrigger>
          </div>
        </PopoverAnchor>
      ) : (
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            role="combobox"
            aria-expanded={isOpen}
            aria-label={ariaLabel}
            aria-busy={loading}
            disabled={disabled}
            size={size}
            aria-invalid={ariaInvalid}
            variant={variant === 'ghost' ? 'ghost' : 'outline'}
            mode="input"
            placeholder={!selectedOption}
            className={cn(
              'w-full justify-between border-input bg-background shadow-xs shadow-black/5',
              variant === 'ghost' &&
                'border-transparent bg-transparent shadow-none hover:bg-accent data-[state=open]:bg-accent',
              className,
            )}
          >
            {triggerContentNode}
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
      )}
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-[220px] border-border bg-popover p-0 text-foreground"
        align="start"
      >
        <Command shouldFilter={false} className="bg-popover text-foreground">
          {searchable ? (
            <CommandInput
              value={query}
              onValueChange={(nextQuery) => {
                setQuery(nextQuery);
                onSearchChange?.(nextQuery);
              }}
              placeholder={searchPlaceholder}
            />
          ) : null}
          <CommandList
            onScroll={onOptionsScroll}
            aria-busy={loading || loadingMore}
          >
            {loading ? (
              <div
                role="status"
                className="px-3 py-6 text-center text-sm text-muted-foreground"
              >
                {loadingMessage}
              </div>
            ) : groupedOptions.length === 0 && !errorMessage ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : (
              groupedOptions.map(([group, groupItems]) => (
                <CommandGroup
                  key={group || 'ungrouped'}
                  heading={group || undefined}
                >
                  {groupItems.map((option) => {
                    const isSelected = option.value === value;

                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                        onSelect={() => handleSelect(option)}
                        className={cn(
                          'min-h-8 text-foreground',
                          option.disabled && 'text-disabled-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate',
                            optionContentClassName,
                          )}
                        >
                          {renderOption
                            ? renderOption(option, isSelected)
                            : option.label}
                        </span>
                        <Check
                          className={cn(
                            'size-4 text-foreground',
                            isSelected ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))
            )}
            {loadingMore ? (
              <div
                role="status"
                className="px-3 py-2 text-center text-xs text-muted-foreground"
              >
                {loadingMoreMessage}
              </div>
            ) : null}
            {!loading && !loadingMore && !errorMessage && onLoadMore ? (
              <div className="p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={onLoadMore}
                >
                  {loadMoreLabel}
                </Button>
              </div>
            ) : null}
            {!loading && errorMessage ? (
              <ErrorState
                title={errorMessage}
                onRetry={onRetry}
                retryLabel={retryLabel}
                className="min-h-0 gap-2 px-3 py-3 [&_svg]:size-4"
              />
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export const OptionSelect = SelectSearch;
export type OptionSelectProps<T = unknown> = SelectSearchProps<T>;
