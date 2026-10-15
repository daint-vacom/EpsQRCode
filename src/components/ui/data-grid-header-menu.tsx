import type { ReactNode } from 'react';
import type { Table } from '@tanstack/react-table';
import { Columns3Cog, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataGridColumnVisibility } from '@/components/ui/data-grid-column-visibility';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DataGridHeaderMenuProps<TData> {
  table: Table<TData>;
  children?: ReactNode;
  onSaveToView?: () => void;
  canSaveToView?: boolean;
  saveDisabled?: boolean;
  isSaving?: boolean;
}

export function DataGridHeaderMenu<TData>({
  table,
  children,
  onSaveToView,
  canSaveToView,
  saveDisabled,
  isSaving,
}: DataGridHeaderMenuProps<TData>) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            mode="icon"
            aria-label="Mở menu bảng"
            title="Mở menu bảng"
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {children}
          <DataGridColumnVisibility
            table={table}
            mode="drawer"
            trigger={
              <DropdownMenuItem>
                <Columns3Cog /> Hiển thị cột
              </DropdownMenuItem>
            }
            onSaveToView={onSaveToView}
            canSaveToView={canSaveToView}
            saveDisabled={saveDisabled}
            isSaving={isSaving}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
