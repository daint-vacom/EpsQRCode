import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardHeading,
  CardTable,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  deleteSoftwareAccountCatalog,
  saveSoftwareAccountCatalog,
} from '../api/software-account-catalog.api';
import {
  SoftwareAccountCatalog as SoftwareAccountCatalogFormDialog,
  useSoftwareAccountCatalogForm,
} from '../forms/software-account-catalog-form.generated';
import {
  emptySoftwareAccountCatalogForm,
  type SoftwareAccountCatalog as SoftwareAccountCatalogRow,
} from '../model/software-account-catalog';
import {
  SOFTWARE_ACCOUNT_CATALOG_COLUMN_PINNING,
  useSoftwareAccountCatalogColumns,
} from '../table/software-account-catalog.columns.generated';

const EMPTY_CATALOGS: SoftwareAccountCatalogRow[] = [];

export function SoftwareAccountCatalogPanel({
  tenantId,
  catalogs,
  isLoading,
  error,
  onRefresh,
}: {
  tenantId: string;
  catalogs?: SoftwareAccountCatalogRow[];
  isLoading: boolean;
  error?: unknown;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const rows = catalogs ?? EMPTY_CATALOGS;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCatalog, setEditingCatalog] =
    useState<SoftwareAccountCatalogRow | null>(null);
  const [deletingCatalog, setDeletingCatalog] =
    useState<SoftwareAccountCatalogRow | null>(null);
  const form = useSoftwareAccountCatalogForm();
  const queryKey = [
    'project',
    'tags',
    'software-account-catalog',
    tenantId,
    'all',
  ];

  const saveMutation = useMutation({
    mutationFn: (values: typeof emptySoftwareAccountCatalogForm) =>
      saveSoftwareAccountCatalog(
        tenantId,
        editingCatalog?.id,
        values,
        editingCatalog?.sortOrder ?? rows.length,
      ),
    onSuccess: async () => {
      toast.success(
        editingCatalog
          ? 'Đã cập nhật tài khoản phần mềm mặc định.'
          : 'Đã thêm tài khoản phần mềm mặc định.',
      );
      setDialogOpen(false);
      setEditingCatalog(null);
      await queryClient.invalidateQueries({ queryKey });
      onRefresh();
    },
    onError: (mutationError) => toast.error(getApiErrorMessage(mutationError)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSoftwareAccountCatalog,
    onSuccess: async () => {
      toast.success('Đã xóa tài khoản phần mềm mặc định.');
      setDeletingCatalog(null);
      await queryClient.invalidateQueries({ queryKey });
      onRefresh();
    },
    onError: (mutationError) => toast.error(getApiErrorMessage(mutationError)),
  });

  const columns = useSoftwareAccountCatalogColumns({
    onEdit: (row) => {
      setEditingCatalog(row);
      form.reset({
        name: row.name,
        description: row.description,
        defaultAccessUrl: row.defaultAccessUrl,
        defaultUsername: row.defaultUsername,
        defaultPassword: row.defaultPassword,
        accountTypes: row.accountTypes,
        isActive: row.isActive,
      });
      setDialogOpen(true);
    },
    onDelete: setDeletingCatalog,
  });
  // The generated table columns own the column contract; this table only owns
  // catalog rows and the standard DataGrid lifecycle.
  const table = useReactTable({
    data: rows,
    columns,
    state: { columnPinning: SOFTWARE_ACCOUNT_CATALOG_COLUMN_PINNING },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  const isMutating = saveMutation.isPending || deleteMutation.isPending;

  function openCreate() {
    setEditingCatalog(null);
    form.reset(emptySoftwareAccountCatalogForm);
    setDialogOpen(true);
  }

  return (
    <>
      <DataGrid
        table={table}
        recordCount={rows.length}
        isLoading={isLoading}
        isFetching={isLoading}
        emptyMessage="Chưa có tài khoản phần mềm mặc định"
      >
        <Card className="min-h-0 w-full min-w-0 flex-1 overflow-hidden">
          <CardHeader className="justify-between">
            <CardHeading>
              <CardTitle>Tài khoản phần mềm</CardTitle>
            </CardHeading>
            <CardToolbar>
              <Button
                type="button"
                variant="primary"
                onClick={openCreate}
                disabled={isLoading || Boolean(error) || isMutating}
              >
                <Plus className="size-4" />
                Thêm tài khoản
              </Button>
            </CardToolbar>
          </CardHeader>
          <CardTable className="min-h-0 flex-1">
            {error ? (
              <div className="flex h-full items-center justify-center p-8 text-sm text-destructive">
                {getApiErrorMessage(error)}
              </div>
            ) : (
              <ScrollArea className="h-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardTable>
        </Card>
      </DataGrid>

      <SoftwareAccountCatalogFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingCatalog(null);
        }}
        mode={editingCatalog ? 'edit' : 'create'}
        form={form}
        onSubmit={(values) => saveMutation.mutate(values)}
        isSaving={saveMutation.isPending}
        title={
          editingCatalog
            ? 'Sửa tài khoản phần mềm mặc định'
            : 'Thêm tài khoản phần mềm mặc định'
        }
      />
      <ConfirmDialog
        open={Boolean(deletingCatalog)}
        onOpenChange={(open) => {
          if (!open) setDeletingCatalog(null);
        }}
        title="Xóa tài khoản phần mềm mặc định?"
        description={`Bạn có chắc muốn xóa "${deletingCatalog?.name ?? ''}"? Các tài khoản đã cấp cho khách hàng sẽ giữ nguyên dữ liệu.`}
        confirmLabel="Xóa tài khoản"
        confirmVariant="destructive"
        onConfirm={() => {
          if (deletingCatalog) deleteMutation.mutate(deletingCatalog.id);
        }}
      />
    </>
  );
}
