import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TagColumnFilter } from '@/project/tags/components/tag-column-filter';
import { Button } from '@/components/ui/button';
import { DataGridFilterDrawer } from '@/components/ui/data-grid-filter-drawer';
import { Label } from '@/components/ui/label';
import {
  EMPLOYEE_LIST_INITIAL_FILTERS,
  type EmployeeListFilters,
  type EmployeeRoleOption,
} from '../model/employee';
import {
  EMPLOYEE_ACCOUNT_FILTER_OPTIONS,
  EMPLOYEE_STATUS_FILTER_OPTIONS,
  toEmployeeRoleFilterOption,
} from '../table/employee-column-filters';
import {
  EmployeeAccountColumnFilter,
  EmployeeRolesColumnFilter,
  EmployeeStatusColumnFilter,
  EmployeeTextColumnFilter,
} from '../table/employee-column-filters.generated';

export interface EmployeeFilterDraft {
  keyword: string;
  filters: EmployeeListFilters;
}

interface EmployeeFilterDrawerProps {
  keyword: string;
  filters: EmployeeListFilters;
  roleOptions: EmployeeRoleOption[];
  roleOptionsLoading?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (draft: EmployeeFilterDraft) => void;
  onReset: () => void;
  onSaveToView?: (draft: EmployeeFilterDraft) => void;
  canSaveToView?: boolean;
  saveDisabled?: boolean;
  isSaving?: boolean;
  trigger: ReactNode;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label variant="secondary">{label}</Label>
      {children}
    </div>
  );
}

export function EmployeeFilterDrawer({
  keyword,
  filters,
  roleOptions,
  roleOptionsLoading = false,
  open,
  onOpenChange,
  onApply,
  onReset,
  onSaveToView,
  canSaveToView = true,
  saveDisabled = false,
  isSaving = false,
  trigger,
}: EmployeeFilterDrawerProps) {
  const [draft, setDraft] = useState<EmployeeFilterDraft>({
    keyword,
    filters,
  });

  useEffect(() => {
    setDraft({ keyword, filters });
  }, [filters, keyword]);

  const updateFilters = (next: Partial<EmployeeListFilters>) => {
    setDraft((current) => ({
      ...current,
      filters: { ...current.filters, ...next },
    }));
  };

  const handleReset = () => {
    setDraft({ keyword: '', filters: EMPLOYEE_LIST_INITIAL_FILTERS });
    onReset();
  };

  const handleSaveToView = () => {
    if (!onSaveToView) return;
    onApply(draft);
    onSaveToView(draft);
    onOpenChange(false);
  };

  return (
    <DataGridFilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Bộ lọc nhân viên"
      onSaveToView={onSaveToView ? handleSaveToView : undefined}
      canSaveToView={canSaveToView}
      saveDisabled={saveDisabled}
      isSaving={isSaving}
      trigger={trigger}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={handleReset}>
            Xóa bộ lọc
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Áp dụng
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Từ khóa">
          <EmployeeTextColumnFilter
            value={draft.keyword}
            onChange={(value) =>
              setDraft((current) => ({ ...current, keyword: value }))
            }
            className="bg-background"
          />
        </Field>
        <Field label="Vai trò">
          <EmployeeRolesColumnFilter
            value={draft.filters.roleIds}
            options={roleOptions.map(toEmployeeRoleFilterOption)}
            disabled={roleOptionsLoading}
            onChange={(value) => updateFilters({ roleIds: value })}
          />
        </Field>
        <Field label="Trạng thái">
          <EmployeeStatusColumnFilter
            value={draft.filters.statuses}
            options={EMPLOYEE_STATUS_FILTER_OPTIONS}
            onChange={(value) => updateFilters({ statuses: value })}
          />
        </Field>
        <Field label="Tài khoản">
          <EmployeeAccountColumnFilter
            value={
              draft.filters.accountLinked === 'all'
                ? ''
                : draft.filters.accountLinked
            }
            options={EMPLOYEE_ACCOUNT_FILTER_OPTIONS}
            onChange={(value) =>
              updateFilters({
                accountLinked:
                  value === ''
                    ? 'all'
                    : (value as EmployeeListFilters['accountLinked']),
              })
            }
            renderOption={(option) => option.label}
          />
        </Field>
        <Field label="Nhóm/nhãn">
          <TagColumnFilter
            value={draft.filters.tagIds}
            onChange={(value) => updateFilters({ tagIds: value })}
            moduleCodes={['organization']}
            ariaLabel="Nhóm/nhãn nhân viên"
          />
        </Field>
      </div>
    </DataGridFilterDrawer>
  );
}
