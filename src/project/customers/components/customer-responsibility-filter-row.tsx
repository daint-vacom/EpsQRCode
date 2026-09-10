import type { TagSelectOption } from '@/project/tags/model/tag';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type {
  CustomerResponsibilityFilterEmployee,
  CustomerResponsibilityFilterMode,
} from '../model/customer-responsibility';
import { CustomerResponsibilityViewSwitcher } from './customer-responsibility-view-switcher.generated';

export interface CustomerResponsibilityFilterRowProps {
  mode: CustomerResponsibilityFilterMode;
  onModeChange: (mode: CustomerResponsibilityFilterMode) => void;
  tagOptions: TagSelectOption[];
  selectedTagIds: string[];
  onTagIdsChange: (tagIds: string[]) => void;
  employeeOptions: CustomerResponsibilityFilterEmployee[];
  selectedEmployeeIds: string[];
  onEmployeeIdsChange: (employeeIds: string[]) => void;
  disabled?: boolean;
}

export function CustomerResponsibilityFilterRow({
  mode,
  onModeChange,
  tagOptions,
  selectedTagIds,
  onTagIdsChange,
  employeeOptions,
  selectedEmployeeIds,
  onEmployeeIdsChange,
  disabled = false,
}: CustomerResponsibilityFilterRowProps) {
  const isGroupMode = mode === 'group';
  const selectedIds = isGroupMode ? selectedTagIds : selectedEmployeeIds;
  const selectedId = selectedIds[0] ?? null;
  const options = isGroupMode ? tagOptions : employeeOptions;

  function selectId(id: string) {
    if (isGroupMode) onTagIdsChange([id]);
    else onEmployeeIdsChange([id]);
  }

  function clearCurrentMode() {
    if (isGroupMode) onTagIdsChange([]);
    else onEmployeeIdsChange([]);
  }

  function switchMode(nextMode: CustomerResponsibilityFilterMode) {
    if (nextMode === mode) return;
    if (nextMode === 'group') onEmployeeIdsChange([]);
    else onTagIdsChange([]);
    onModeChange(nextMode);
  }

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2">
      <CustomerResponsibilityViewSwitcher
        value={mode}
        onValueChange={(value) =>
          switchMode(value as CustomerResponsibilityFilterMode)
        }
        disabled={disabled}
        className="shrink-0"
      />
      <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
      <div
        className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={isGroupMode ? 'Lọc theo nhóm nhãn' : 'Lọc theo nhân viên'}
      >
        <div className="flex min-w-full w-max flex-nowrap items-center gap-1.5">
          <Button
            type="button"
            variant={selectedIds.length === 0 ? 'primary' : 'light-neutral'}
            size="md"
            className="shrink-0 rounded-full"
            onClick={clearCurrentMode}
            disabled={disabled}
            aria-pressed={selectedIds.length === 0}
          >
            Tất cả
          </Button>
          {options.map((option) => {
            const selected = selectedId === option.id;
            const isTag = isGroupMode;
            const label = isTag
              ? (option as TagSelectOption).name
              : (option as CustomerResponsibilityFilterEmployee).displayName;
            const count = isTag
              ? null
              : (option as CustomerResponsibilityFilterEmployee).customerCount;

            return (
              <Button
                key={option.id}
                type="button"
                variant={selected ? 'primary' : 'light-neutral'}
                size="md"
                className="shrink-0 rounded-full"
                onClick={() => selectId(option.id)}
                disabled={disabled}
                aria-pressed={selected}
                title={
                  count == null
                    ? label
                    : `${label}: ${count} khách hàng đang phụ trách`
                }
              >
                {isTag ? (
                  <span
                    className="size-2 rounded-full"
                    style={{
                      backgroundColor:
                        (option as TagSelectOption).color ?? '#64748b',
                    }}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="max-w-48 truncate">{label}</span>
                {count != null ? (
                  <span
                    className={cn(
                      selected
                        ? 'text-primary-foreground/80'
                        : 'text-muted-foreground',
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </Button>
            );
          })}
          {options.length === 0 ? (
            <span className="shrink-0 px-1 text-xs text-muted-foreground">
              {isGroupMode
                ? 'Chưa có nhóm nhãn.'
                : 'Chưa có nhân viên phụ trách.'}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
