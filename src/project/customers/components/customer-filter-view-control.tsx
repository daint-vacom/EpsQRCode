import { useState } from 'react';
import {
  Check,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  Settings2,
  SlidersHorizontal,
  UsersRound,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { CustomerSavedView } from '../model/customer-saved-view';

interface CustomerFilterViewControlProps {
  views: readonly CustomerSavedView[];
  activeViewId: string | null;
  canManage: boolean;
  isLoading?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  showInlineFilters: boolean;
  onShowInlineFiltersChange: (show: boolean) => void;
  showResponsibilityFilters: boolean;
  onShowResponsibilityFiltersChange: (show: boolean) => void;
  onOpenFilterDrawer: () => void;
  onSelect: (viewId: string | null) => void;
  onCreate: () => void;
  onEdit: (view: CustomerSavedView) => void;
  onSaveCurrent: () => void;
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
  showResponsibilityFilters,
  onShowResponsibilityFiltersChange,
  onOpenFilterDrawer,
  onSelect,
  onCreate,
  onEdit,
  onSaveCurrent,
}: CustomerFilterViewControlProps) {
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const activeView = views.find((view) => view.id === activeViewId) ?? null;

  return (
    <div className="inline-flex items-center gap-1">
      <DropdownMenu open={viewMenuOpen} onOpenChange={setViewMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            mode="icon"
            disabled={isLoading}
            aria-label="Chọn chế độ xem hoặc thao tác bộ lọc"
            title={activeView?.name ?? 'Tùy chọn chế độ xem và bộ lọc'}
          >
            <MoreVertical />
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
            <div key={view.id} className="group relative">
              <DropdownMenuItem
                className="me-8 pe-2"
                onSelect={(event) => {
                  if (
                    event.target instanceof HTMLElement &&
                    event.target.closest('[data-view-edit-action]')
                  ) {
                    event.preventDefault();
                    return;
                  }

                  onSelect(view.id);
                }}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {activeViewId === view.id ? (
                    <Check className="size-4 text-primary" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{view.name}</span>
              </DropdownMenuItem>
              {canManage ? (
                <span className="absolute end-1 top-1/2 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Sửa view ${view.name}`}
                        data-view-edit-action
                        className="size-6 text-primary"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setViewMenuOpen(false);
                          onEdit(view);
                        }}
                      >
                        <Pencil className="size-3.5 !opacity-100" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent variant="light">Sửa view</TooltipContent>
                  </Tooltip>
                </span>
              ) : null}
            </div>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onOpenFilterDrawer}>
            <SlidersHorizontal />
            Mở bộ lọc nâng cao
          </DropdownMenuItem>
          <DropdownMenuItem
            className="justify-between gap-3"
            onSelect={(event) => event.preventDefault()}
          >
            <span className="flex min-w-0 items-center gap-2">
              <SlidersHorizontal />
              <span className="truncate">Hiển thị bộ lọc theo cột</span>
            </span>
            <Switch
              size="sm"
              checked={showInlineFilters}
              onCheckedChange={onShowInlineFiltersChange}
              aria-label="Hiển thị bộ lọc theo cột"
              onClick={(event) => event.stopPropagation()}
            />
          </DropdownMenuItem>
          <DropdownMenuItem
            className="justify-between gap-3"
            onSelect={(event) => event.preventDefault()}
          >
            <span className="flex min-w-0 items-center gap-2">
              <UsersRound />
              <span className="truncate">Hiển thị lọc nhóm/nhân viên</span>
            </span>
            <Switch
              size="sm"
              checked={showResponsibilityFilters}
              onCheckedChange={onShowResponsibilityFiltersChange}
              aria-label="Hiển thị lọc nhóm/nhân viên"
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
          'ms-1 flex h-8.5 min-w-0 items-center overflow-hidden rounded-md bg-muted/80 text-xs text-secondary-foreground transition-all duration-200 ease-out',
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
