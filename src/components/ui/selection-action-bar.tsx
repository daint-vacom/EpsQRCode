import type { ReactNode } from 'react';
import { ClipboardPaste, Copy, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OptionSelect } from '@/components/ui/option-select';
import type { SelectOption } from '@/components/ui/option-select';
import { Separator } from '@/components/ui/separator';
import { ActionBarSurface } from './action-bar-surface';

export type SelectionActionIcon = 'copy' | 'paste' | 'delete' | 'edit';

export interface SelectionActionOption {
  value: string;
  label: string;
  icon?: SelectionActionIcon;
  destructive?: boolean;
}

export function SelectionActionBar({
  ariaLabel,
  selectionLabel,
  actionLabel,
  actionPlaceholder,
  actions,
  action,
  onActionChange,
  applyLabel,
  onApply,
  applyDisabled,
  onClear,
  clearLabel,
  extraControl,
  className,
}: {
  ariaLabel: string;
  selectionLabel: ReactNode;
  actionLabel: string;
  actionPlaceholder: string;
  actions: SelectionActionOption[];
  action: string;
  onActionChange: (value: string) => void;
  applyLabel: string;
  onApply: (action: string) => void;
  applyDisabled: boolean;
  onClear?: () => void;
  clearLabel?: string;
  extraControl?: ReactNode;
  className?: string;
}) {
  const options: SelectOption<SelectionActionOption>[] = actions.map(
    (item) => ({
      value: item.value,
      label: item.label,
      data: item,
    }),
  );
  const resolvedAction = actions.some((item) => item.value === action)
    ? action
    : (actions[0]?.value ?? '');

  return (
    <ActionBarSurface ariaLabel={ariaLabel} className={className}>
      <span className="px-1 text-sm font-medium text-foreground">
        {selectionLabel}
      </span>
      <Separator orientation="vertical" className="h-5" />
      <OptionSelect
        value={resolvedAction}
        onChange={onActionChange}
        options={options}
        placeholder={actionPlaceholder}
        ariaLabel={actionLabel}
        searchable={false}
        size="md"
        className="w-64"
        renderOption={(option) => {
          const Icon = getActionIcon(option.data?.icon);
          return (
            <span className="flex items-center gap-2">
              {Icon ? (
                <Icon
                  className={`size-4 shrink-0 ${option.data?.destructive ? 'text-destructive' : ''}`}
                />
              ) : null}
              <span
                className={option.data?.destructive ? 'text-destructive' : ''}
              >
                {option.label}
              </span>
            </span>
          );
        }}
      />
      {extraControl}
      <Button
        type="button"
        variant="primary"
        size="md"
        disabled={applyDisabled || !resolvedAction}
        onClick={() => onApply(resolvedAction)}
      >
        {applyLabel}
      </Button>
      {onClear ? (
        <>
          <Separator orientation="vertical" className="h-5" />
          <Button type="button" variant="ghost" size="md" onClick={onClear}>
            {clearLabel}
          </Button>
        </>
      ) : null}
    </ActionBarSurface>
  );
}

function getActionIcon(icon: SelectionActionIcon | undefined) {
  if (icon === 'copy') return Copy;
  if (icon === 'paste') return ClipboardPaste;
  if (icon === 'delete') return Trash2;
  if (icon === 'edit') return SlidersHorizontal;
  return null;
}
