/**
 * Scaffolded by table-builder from `src/project/tags/table/software-account-catalog.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
  type StatusBadgeConfig,
} from '@/components/ui/data-grid-columns';
import type { SoftwareAccountCatalog } from '../model/software-account-catalog';

export const SOFTWARE_ACCOUNT_CATALOG_COLUMN_PINNING: ColumnPinningState = {
  left: ['name'],
  right: ['actions'],
};

const isActiveBadgeConfig: StatusBadgeConfig<string> = {
  true: {
    label: 'Đang sử dụng',
    className:
      'rounded-md border-transparent bg-admin-success-bg px-2.5 py-1 text-xs text-admin-success-text',
  },
  false: {
    label: 'Ngừng sử dụng',
    className:
      'rounded-md border-transparent bg-muted px-2.5 py-1 text-xs text-muted-foreground',
  },
};

export interface UseSoftwareAccountCatalogColumnsParams {
  onEdit: (row: SoftwareAccountCatalog) => void;
  onDelete: (row: SoftwareAccountCatalog) => void;
}

export function useSoftwareAccountCatalogColumns(
  params: UseSoftwareAccountCatalogColumnsParams,
): ColumnDef<SoftwareAccountCatalog>[] {
  const { onEdit, onDelete } = params;
  return useMemo(() => {
    const col = createColumnHelpers<SoftwareAccountCatalog>();

    return [
      col.custom({
        id: 'name',
        header: 'Tên phần mềm',
        size: 220,
        enableSorting: false,
        cell: (row) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">
              {row.name}
            </div>
            {row.description ? (
              <div className="truncate text-xs text-muted-foreground">
                {row.description}
              </div>
            ) : null}
          </div>
        ),
      }),
      col.text({
        id: 'defaultAccessUrl',
        header: 'Địa chỉ truy cập mặc định',
        get: (row) => row.defaultAccessUrl,
        size: 280,
        enableSorting: false,
      }),
      col.text({
        id: 'defaultUsername',
        header: 'Tài khoản mặc định',
        get: (row) => row.defaultUsername,
        size: 180,
        enableSorting: false,
      }),
      col.custom({
        id: 'defaultPassword',
        header: 'Mật khẩu mặc định',
        size: 180,
        enableSorting: false,
        cell: (row) =>
          row.hasDefaultPassword ? (
            <span aria-label="Mật khẩu mặc định đã lưu">••••••••</span>
          ) : null,
      }),
      col.custom({
        id: 'accountTypes',
        header: 'Loại tài khoản',
        size: 260,
        enableSorting: false,
        cell: (row) => (
          <div className="flex flex-wrap gap-1.5">
            {row.accountTypes.map((accountType) => (
              <Badge
                key={accountType.name}
                variant={accountType.isDefault ? 'primary' : 'secondary'}
                appearance="light"
                size="sm"
              >
                {accountType.name}
              </Badge>
            ))}
          </div>
        ),
      }),
      col.badge({
        id: 'isActive',
        header: 'Trạng thái',
        get: (row) => row.isActive,
        config: isActiveBadgeConfig,
        size: 170,
        enableSorting: false,
      }),
      col.actions({
        id: 'actions',
        header: '',
        cellClassName: 'text-right',
        size: getDataGridActionsColumnSize(2),
        enableSorting: false,
        cell: (row) => (
          <div className="flex justify-end gap-1">
            <DataGridActionButton
              action="edit"
              tooltip="Sửa"
              aria-label="Sửa"
              type="button"
              mode="icon"
              size="sm"
              onClick={() => onEdit(row)}
            >
              <Pencil className="size-4" />
            </DataGridActionButton>
            <DataGridActionButton
              action="delete"
              tooltip="Xóa"
              aria-label="Xóa"
              type="button"
              mode="icon"
              size="sm"
              onClick={() => onDelete(row)}
            >
              <Trash2 className="size-4" />
            </DataGridActionButton>
          </div>
        ),
      }),
    ];
  }, [onEdit, onDelete]);
}
