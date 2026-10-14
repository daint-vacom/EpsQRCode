/**
 * Scaffolded by table-builder from `src/examples/material/models/table/material-model.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createColumnHelpers } from '@/components/ui/data-grid-columns';
import { Switch } from '@/components/ui/switch';
import { MaterialIdentity } from '@/components/material-identity';
import type { ExampleMaterialModel } from '../../model/material-model';

export const EXAMPLE_MATERIAL_MODEL_COLUMN_PINNING: ColumnPinningState = {
  right: ['actions'],
};

export interface UseExampleMaterialModelColumnsParams {
  onToggle: (row: ExampleMaterialModel, isActive: boolean) => void;
  onView: (row: ExampleMaterialModel) => void;
  onEdit: (row: ExampleMaterialModel) => void;
  onDelete: (row: ExampleMaterialModel) => void;
}

export function useExampleMaterialModelColumns({
  onToggle,
  onView,
  onEdit,
  onDelete,
}: UseExampleMaterialModelColumnsParams): ColumnDef<ExampleMaterialModel>[] {
  return useMemo(() => {
    const col = createColumnHelpers<ExampleMaterialModel>();

    return [
      col.custom({
        id: 'availability',
        header: 'Sử dụng',
        headerClassName: 'w-[110px]',
        size: 110,
        enableSorting: false,
        cell: (row) => (
          <Switch
            checked={row.isActive ?? true}
            onCheckedChange={(checked) => onToggle(row, checked)}
            aria-label={`${row.isActive !== false ? 'Ngừng sử dụng' : 'Sử dụng'} mẫu ${row.name}`}
          />
        ),
      }),
      col.custom({
        id: 'identity',
        header: 'Mẫu vật tư',
        headerClassName: 'min-w-[260px]',
        size: 320,
        enableSorting: false,
        cell: (row) => (
          <MaterialIdentity
            name={row.name}
            code={row.code}
            imageUrl={row.imageUrls[0]}
          />
        ),
      }),
      col.date({
        id: 'createdAt',
        header: 'Ngày tạo',
        get: (row) => row.createdAt,
        size: 150,
        enableSorting: false,
      }),
      col.date({
        id: 'updatedAt',
        header: 'Ngày chỉnh sửa',
        get: (row) => row.updatedAt,
        size: 170,
        enableSorting: false,
      }),
      col.actions({
        header: 'Thao tác',
        headerClassName: 'w-[132px]',
        cellClassName: 'text-right',
        size: 132,
        enableSorting: false,
        cell: (row) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Xem mẫu ${row.name}`}
              onClick={() => onView(row)}
            >
              <Eye className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Sửa mẫu ${row.name}`}
              onClick={() => onEdit(row)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Xóa mẫu ${row.name}`}
              className="text-muted-foreground"
              onClick={() => onDelete(row)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ),
      }),
    ];
  }, [onToggle, onView, onEdit, onDelete]);
}
