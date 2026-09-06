import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DataGridFilterDrawer } from '@/components/ui/data-grid-filter-drawer';
import { Label } from '@/components/ui/label';
import type { CustomerSelectOption } from '../../customers/api/customers.api';
import {
  CONTRACT_LIST_INITIAL_FILTERS,
  type ContractListFilters,
} from '../model/contract';
import {
  CONTRACT_STATUS_FILTER_OPTIONS,
  renderContractCustomerFilterTrigger,
  toContractCustomerFilterOption,
} from '../table/contract-column-filters';
import {
  ContractCustomerColumnFilter,
  ContractNextDueColumnFilter,
  ContractOutstandingColumnFilter,
  ContractStatusColumnFilter,
  ContractTextColumnFilter,
} from '../table/contract-column-filters.generated';

export interface ContractFilterDraft {
  keyword: string;
  filters: ContractListFilters;
}

interface ContractFilterDrawerProps {
  keyword: string;
  filters: ContractListFilters;
  customerOptions: CustomerSelectOption[];
  customerOptionsLoading?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (draft: ContractFilterDraft) => void;
  onReset: () => void;
  onSaveToView?: (draft: ContractFilterDraft) => void;
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

export function ContractFilterDrawer({
  keyword,
  filters,
  customerOptions,
  customerOptionsLoading = false,
  open,
  onOpenChange,
  onApply,
  onReset,
  onSaveToView,
  canSaveToView = true,
  saveDisabled = false,
  isSaving = false,
  trigger,
}: ContractFilterDrawerProps) {
  const [draft, setDraft] = useState<ContractFilterDraft>({
    keyword,
    filters,
  });

  useEffect(() => {
    setDraft({ keyword, filters });
  }, [filters, keyword]);

  const update = (next: Partial<ContractListFilters>) =>
    setDraft((current) => ({
      ...current,
      filters: { ...current.filters, ...next },
    }));

  const handleReset = () => {
    setDraft({ keyword: '', filters: CONTRACT_LIST_INITIAL_FILTERS });
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
      title="Bộ lọc hợp đồng"
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
          <ContractTextColumnFilter
            value={draft.keyword}
            onChange={(value) =>
              setDraft((current) => ({ ...current, keyword: value }))
            }
          />
        </Field>
        <Field label="Khách hàng">
          <ContractCustomerColumnFilter
            value={draft.customerId}
            options={customerOptions.map(toContractCustomerFilterOption)}
            loading={customerOptionsLoading}
            disabled={customerOptionsLoading && customerOptions.length === 0}
            triggerContent={renderContractCustomerFilterTrigger}
            renderOption={(option) => option.label}
            onChange={(value) => update({ customerId: value })}
          />
        </Field>
        <Field label="Trạng thái">
          <ContractStatusColumnFilter
            value={draft.status}
            options={CONTRACT_STATUS_FILTER_OPTIONS}
            onChange={(value) =>
              update({ status: value as ContractListFilters['status'] })
            }
          />
        </Field>
        <Field label="Còn phải thu">
          <ContractOutstandingColumnFilter
            value={{ min: draft.outstandingMin, max: draft.outstandingMax }}
            onChange={(value) =>
              update({ outstandingMin: value.min, outstandingMax: value.max })
            }
          />
        </Field>
        <Field label="Hạn thu tiếp theo">
          <ContractNextDueColumnFilter
            value={{ from: draft.nextDueFrom, to: draft.nextDueTo }}
            onChange={(value) =>
              update({
                nextDueFrom: value.from ?? '',
                nextDueTo: value.to ?? '',
              })
            }
          />
        </Field>
      </div>
    </DataGridFilterDrawer>
  );
}
