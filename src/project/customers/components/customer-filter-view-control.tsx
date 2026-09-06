import { useState } from 'react';
import type { CustomField } from '@/project/data-configuration/model/custom-field';
import {
  Check,
  ChevronDown,
  Plus,
  Save,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import type {
  CustomerFilterFormValues,
  CustomerListFilters,
} from '../model/customer';
import type { CustomerSavedView } from '../model/customer-saved-view';
import { CustomerFilterDrawer } from './customer-filter-drawer';

interface CustomerFilterViewControlProps {
  views: readonly CustomerSavedView[];
  activeViewId: string | null;
  canManage: boolean;
  isLoading?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  showInlineFilters: boolean;
  onShowInlineFiltersChange: (show: boolean) => void;
  filters: CustomerListFilters;
  customFields?: CustomField[];
  onSelect: (viewId: string | null) => void;
  onCreate: () => void;
  onEdit: (view: CustomerSavedView) => void;
  onSaveCurrent: () => void;
  onApply: (values: CustomerFilterFormValues) => void;
  onReset: () => void;
  onSaveToView?: (values: CustomerFilterFormValues) => void;
  canSaveToView?: boolean;
  saveDisabled?: boolean;
}

export function CustomerFilterViewControl({
  views,
  activeViewId,
  canManage,
  isLoading = false,
  isDirty = false,
  isSaving = false,
  showInlineFilters,
  onShowInlineFiltersChange,
  filters,
  customFields = [],
  onSelect,
  onCreate,
  onEdit,
  onSaveCurrent,
  onApply,
  onReset,
  onSaveToView,
  canSaveToView = true,
  saveDisabled = false,
}: CustomerFilterViewControlProps) {
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const activeView = views.find((view) => view.id === activeViewId) ?? null;

  return (
    <div className="inline-flex items-stretch">
      <CustomerFilterDrawer
        filters={filters}
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        customFields={customFields}
        onApply={onApply}
        onReset={onReset}
        onSaveToView={onSaveToView}
        canSaveToView={canSaveToView}
        saveDisabled={saveDisabled}
        isSaving={isSaving}
        trigger={
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            className="rounded-e-none border-e-0"
          >
            <SlidersHorizontal />
            Bộ lọc chi tiết
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            mode="icon"
            disabled={isLoading}
            aria-label="Chọn chế độ xem hoặc thao tác bộ lọc"
            title={activeView?.name ?? 'Tất cả khách hàng'}
            className="-ms-px rounded-s-none px-2"
          >
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Chế độ xem</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onSelect(null)}>
            <span className="flex size-4 shrink-0 items-center justify-center">
              {activeViewId === null ? (
                <Check className="size-4 text-primary" />
              ) : null}
            </span>
            Tất cả khách hàng
          </DropdownMenuItem>
          {views.map((view) => (
            <DropdownMenuItem key={view.id} onSelect={() => onSelect(view.id)}>
              <span className="flex size-4 shrink-0 items-center justify-center">
                {activeViewId === view.id ? (
                  <Check className="size-4 text-primary" />
                ) : null}
              </span>
              <span className="min-w-0 truncate">{view.name}</span>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setFilterDrawerOpen(true)}>
            <SlidersHorizontal />
            Mở bộ lọc nâng cao
          </DropdownMenuItem>
          <DropdownMenuItem
            className="justify-between gap-3"
            onSelect={(event) => event.preventDefault()}
          >
            <span className="flex min-w-0 items-center gap-2">
              <SlidersHorizontal />
              <span className="truncate">Hiển thị bộ lọc trên bảng</span>
            </span>
            <Switch
              size="sm"
              checked={showInlineFilters}
              onCheckedChange={onShowInlineFiltersChange}
              aria-label="Hiển thị bộ lọc inline"
              onClick={(event) => event.stopPropagation()}
            />
          </DropdownMenuItem>

          {canManage ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onCreate}>
                <Plus />
                Tạo view theo bộ lọc hiện tại
              </DropdownMenuItem>
              {activeView && isDirty ? (
                <DropdownMenuItem disabled={isSaving} onSelect={onSaveCurrent}>
                  <Save />
                  Lưu thay đổi vào view đang chọn
                </DropdownMenuItem>
              ) : null}
              {activeView ? (
                <DropdownMenuItem onSelect={() => onEdit(activeView)}>
                  <Settings2 />
                  Chỉnh sửa view hiện tại
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
