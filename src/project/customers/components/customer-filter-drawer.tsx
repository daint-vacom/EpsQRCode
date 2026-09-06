import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { CustomField } from '@/project/data-configuration/model/custom-field';
import { Button } from '@/components/ui/button';
import { DataGridFilterDrawer } from '@/components/ui/data-grid-filter-drawer';
import {
  customerFilterDefaultValues,
  CustomerFilterForm,
  useCustomerFilterForm,
} from '../forms/customer-filter-form.generated';
import type {
  CustomerFilterFormValues,
  CustomerListFilters,
} from '../model/customer';

interface CustomerFilterDrawerProps {
  filters: CustomerListFilters;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onApply: (values: CustomerFilterFormValues) => void;
  onReset: () => void;
  onSaveToView?: (values: CustomerFilterFormValues) => void;
  canSaveToView?: boolean;
  saveDisabled?: boolean;
  isSaving?: boolean;
  customFields?: CustomField[];
  trigger?: ReactNode;
}

export function CustomerFilterDrawer({
  filters,
  open,
  onOpenChange,
  onApply,
  onReset,
  onSaveToView,
  canSaveToView = true,
  saveDisabled = false,
  isSaving = false,
  customFields = [],
  trigger,
}: CustomerFilterDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const form = useCustomerFilterForm({ defaultValues: filters });
  const isOpen = open ?? internalOpen;

  const setDrawerOpen = (nextOpen: boolean) => {
    if (open === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    form.reset(filters);
  }, [filters, form]);

  const handleSubmit = (values: CustomerFilterFormValues) => {
    onApply(values);
    setDrawerOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setDrawerOpen(nextOpen);
    if (!nextOpen) form.reset(filters);
  };

  const handleReset = () => {
    form.reset(customerFilterDefaultValues);
    onReset();
  };

  const handleSaveToView = () => {
    if (!onSaveToView) return;

    void form.handleSubmit((values) => {
      onApply(values);
      onSaveToView(values);
      setDrawerOpen(false);
    })();
  };

  return (
    <DataGridFilterDrawer
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="Bộ lọc khách hàng"
      onSaveToView={onSaveToView ? handleSaveToView : undefined}
      canSaveToView={canSaveToView}
      saveDisabled={saveDisabled && !form.formState.isDirty}
      isSaving={isSaving}
      trigger={trigger}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={handleReset}>
            Xóa bộ lọc
          </Button>
          <Button type="submit" form="customer-filter-form" variant="primary">
            Áp dụng
          </Button>
        </div>
      }
    >
      <CustomerFilterForm
        form={form}
        onSubmit={handleSubmit}
        id="customer-filter-form"
        customFields={customFields}
      />
    </DataGridFilterDrawer>
  );
}
