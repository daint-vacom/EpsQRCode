import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TagColumnFilter } from '@/project/tags/components/tag-column-filter';
import { Button } from '@/components/ui/button';
import { DataGridFilterDrawer } from '@/components/ui/data-grid-filter-drawer';
import { Label } from '@/components/ui/label';
import type { MultiSelectOption } from '@/components/ui/multi-select';
import {
  CONTRACT_TEMPLATE_LIST_INITIAL_FILTERS,
  CONTRACT_TEMPLATE_STATUS_LABELS,
  CONTRACT_TEMPLATE_STATUSES,
  type ContractTemplateListFilters,
} from '../model/contract-template';
import {
  ContractTemplateContractCountColumnFilter,
  ContractTemplateLineCountColumnFilter,
  ContractTemplateStatusColumnFilter,
  ContractTemplateTextColumnFilter,
  ContractTemplateUpdatedAtColumnFilter,
  ContractTemplateVersionNoColumnFilter,
} from './contract-template-column-filters.generated';
import { ContractTemplateStatusBadge } from './contract-template-status-badge';

const statusOptions: MultiSelectOption[] = CONTRACT_TEMPLATE_STATUSES.map(
  (status) => ({
    value: status,
    label: <ContractTemplateStatusBadge status={status} size="sm" />,
    searchableText: CONTRACT_TEMPLATE_STATUS_LABELS[status],
  }),
);

export interface ContractTemplateFilterDraft {
  keyword: string;
  filters: ContractTemplateListFilters;
}

interface ContractTemplateFilterDrawerProps {
  keyword: string;
  filters: ContractTemplateListFilters;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (draft: ContractTemplateFilterDraft) => void;
  onReset: () => void;
  onSaveToView?: (draft: ContractTemplateFilterDraft) => void;
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

export function ContractTemplateFilterDrawer({
  keyword,
  filters,
  open,
  onOpenChange,
  onApply,
  onReset,
  onSaveToView,
  canSaveToView = true,
  saveDisabled = false,
  isSaving = false,
  trigger,
}: ContractTemplateFilterDrawerProps) {
  const [draft, setDraft] = useState<ContractTemplateFilterDraft>({
    keyword,
    filters,
  });

  useEffect(() => {
    setDraft({ keyword, filters });
  }, [filters, keyword]);

  const update = (next: Partial<ContractTemplateListFilters>) =>
    setDraft((current) => ({
      ...current,
      filters: { ...current.filters, ...next },
    }));

  const handleReset = () => {
    setDraft({ keyword: '', filters: CONTRACT_TEMPLATE_LIST_INITIAL_FILTERS });
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
      title="Bộ lọc mẫu hợp đồng"
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
          <ContractTemplateTextColumnFilter
            value={draft.keyword}
            onChange={(value) =>
              setDraft((current) => ({ ...current, keyword: value }))
            }
          />
        </Field>
        <Field label="Trạng thái">
          <ContractTemplateStatusColumnFilter
            value={draft.statuses}
            options={statusOptions}
            onChange={(value) =>
              update({
                statuses: value as ContractTemplateListFilters['statuses'],
                status:
                  value.length === 1
                    ? (value[0] as ContractTemplateListFilters['status'])
                    : 'all',
              })
            }
          />
        </Field>
        <Field label="Nhóm/danh mục">
          <TagColumnFilter
            value={draft.tagIds}
            onChange={(value) => update({ tagIds: value })}
            moduleCodes={['contracts']}
            ariaLabel="Nhóm/danh mục mẫu hợp đồng"
          />
        </Field>
        <Field label="Số khoản phí">
          <ContractTemplateLineCountColumnFilter
            value={{ min: draft.lineCountMin, max: draft.lineCountMax }}
            onChange={(value) =>
              update({ lineCountMin: value.min, lineCountMax: value.max })
            }
          />
        </Field>
        <Field label="Số hợp đồng đã tạo">
          <ContractTemplateContractCountColumnFilter
            value={{ min: draft.contractCountMin, max: draft.contractCountMax }}
            onChange={(value) =>
              update({
                contractCountMin: value.min,
                contractCountMax: value.max,
              })
            }
          />
        </Field>
        <Field label="Phiên bản">
          <ContractTemplateVersionNoColumnFilter
            value={{ min: draft.versionNoMin, max: draft.versionNoMax }}
            onChange={(value) =>
              update({ versionNoMin: value.min, versionNoMax: value.max })
            }
          />
        </Field>
        <Field label="Cập nhật gần nhất">
          <ContractTemplateUpdatedAtColumnFilter
            value={{ from: draft.updatedFrom, to: draft.updatedTo }}
            onChange={(value) =>
              update({
                updatedFrom: value.from ?? '',
                updatedTo: value.to ?? '',
              })
            }
          />
        </Field>
      </div>
    </DataGridFilterDrawer>
  );
}
