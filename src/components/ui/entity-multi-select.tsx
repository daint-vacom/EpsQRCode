import { useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type EntityMultiSelectSize = 'md' | 'lg';

export interface EntityMultiSelectOption {
  value: string;
  title: ReactNode;
  description: ReactNode;
  avatar: ReactNode;
  tooltip?: ReactNode;
  searchText: string;
  disabled?: boolean;
}

export interface EntityMultiSelectProps {
  value: string[];
  options: readonly EntityMultiSelectOption[];
  onChange: (value: string[]) => void;
  size?: EntityMultiSelectSize;
  disabled?: boolean;
  addLabel?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

function EntityOptionContent({
  option,
  size,
}: {
  option: EntityMultiSelectOption;
  size: EntityMultiSelectSize;
}) {
  const content = (
    <span
      className={cn(
        'flex min-w-0 items-center',
        size === 'lg' ? 'gap-3' : 'gap-2',
      )}
    >
      <span className="shrink-0">{option.avatar}</span>
      <span className="min-w-0 flex-1">
        <span
          className={
            size === 'lg'
              ? 'block truncate text-sm font-medium text-foreground'
              : 'block truncate text-[0.8125rem] font-medium leading-5 text-foreground'
          }
        >
          {option.title}
        </span>
        {size === 'lg' && option.description ? (
          <span className="block truncate text-xs leading-4 text-muted-foreground">
            {option.description}
          </span>
        ) : null}
      </span>
    </span>
  );

  if (!option.tooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>{option.tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function EntityMultiSelect({
  value,
  options,
  onChange,
  size = 'md',
  disabled = false,
  addLabel = 'Thêm',
  searchPlaceholder = 'Tìm...',
  emptyMessage = 'Không có kết quả',
}: EntityMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedOptions = value
    .map((item) => options.find((option) => option.value === item))
    .filter((option): option is EntityMultiSelectOption => Boolean(option));
  const availableOptions = options.filter(
    (option) => !value.includes(option.value),
  );

  return (
    <div className="min-w-0 space-y-2">
      {selectedOptions.map((option) => (
        <div
          key={option.value}
          className={cn(
            'flex min-w-0 items-center gap-2 rounded-md border border-border bg-background px-3 shadow-xs shadow-black/5',
            size === 'lg' ? 'min-h-14 py-2' : 'min-h-8.5 py-1',
          )}
        >
          <span className="min-w-0 flex-1">
            <EntityOptionContent option={option} size={size} />
          </span>
          <Button
            type="button"
            variant="ghost"
            mode="icon"
            size="sm"
            className="text-muted-foreground/60 hover:bg-transparent hover:text-muted-foreground"
            aria-label={`Bỏ ${option.searchText}`}
            title={`Bỏ ${option.searchText}`}
            onClick={() =>
              onChange(value.filter((item) => item !== option.value))
            }
            disabled={disabled}
          >
            <X />
          </Button>
        </div>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size={size}
            className="px-2 text-muted-foreground"
            disabled={disabled || availableOptions.length === 0}
          >
            <Plus /> {addLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-64 p-0"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {availableOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.searchText} ${option.value}`}
                  disabled={option.disabled}
                  onSelect={() => {
                    onChange([...value, option.value]);
                    setOpen(false);
                  }}
                  className={size === 'lg' ? 'min-h-12' : 'min-h-8.5'}
                >
                  <EntityOptionContent option={option} size={size} />
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
