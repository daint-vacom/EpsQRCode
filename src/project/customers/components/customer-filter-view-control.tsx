import { useState } from 'react';
import type { CustomField } from '@/project/data-configuration/model/custom-field';
import {
  Check,
  ChevronDown,
  Plus,
  Save,
  Settings2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
      <div
        aria-hidden={!activeView}
        className={cn(
          '-ms-px flex h-8.5 min-w-0 items-center overflow-hidden rounded-e-md bg-muted/80 text-xs text-secondary-foreground transition-all duration-200 ease-out',
          activeView
            ? 'max-w-48 translate-x-0 px-2.5 opacity-100'
            : 'pointer-events-none max-w-0 -translate-x-2 px-0 opacity-0',
        )}
        title={activeView?.name}
      >
        <span className="min-w-0 max-w-40 truncate">
          {activeView?.name ?? ''}
        </span>
        <button
          type="button"
          disabled={!activeView}
          aria-label={activeView ? `Bỏ view ${activeView.name}` : undefined}
          className="ms-1 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted-foreground/60 text-background transition-colors hover:bg-muted-foreground/80 hover:text-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelect(null);
          }}
        >
          <X className="size-2.5" />
        </button>
      </div>
    </div>
  );
}
