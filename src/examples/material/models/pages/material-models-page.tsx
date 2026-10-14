import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Boxes, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { MaterialIdentity } from '@/components/material-identity';
import { ConfirmDeleteDialog } from '../../components/confirm-delete-dialog';
import type { ExampleMaterialModel } from '../../model/material-model';
import { useMaterialCatalogStore } from '../../stores/material-catalog.store';
import {
  EXAMPLE_MATERIAL_MODEL_COLUMN_PINNING,
  useExampleMaterialModelColumns,
} from '../components/material-model-columns.generated';

function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
export function ExampleMaterialModelsPage() {
  const navigate = useNavigate();
  const {
    materials,
    exampleMaterialModels: models,
    removeExampleMaterialModel,
    setExampleMaterialModelActive,
  } = useMaterialCatalogStore();
  const [keyword, setKeyword] = useState('');
  const [deleting, setDeleting] = useState<ExampleMaterialModel | null>(null);
  const [viewing, setViewing] = useState<ExampleMaterialModel | null>(null);

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase('vi');
    if (!normalized) return models;
    return models.filter((model) =>
      [model.name, model.code].some((value) =>
        value.toLocaleLowerCase('vi').includes(normalized),
      ),
    );
  }, [models, keyword]);

  const columns = useExampleMaterialModelColumns({
    onToggle: (model, isActive) => {
      setExampleMaterialModelActive(model.id, isActive);
      toast.success(
        isActive
          ? `Đã bật sử dụng mẫu “${model.name}”.`
          : `Đã ngừng sử dụng mẫu “${model.name}”.`,
      );
    },
    onView: setViewing,
    onEdit: (model) =>
      navigate(
        buildPath(ROUTES.EXAMPLE.MATERIAL_MODEL_DEMO_EDIT, { id: model.id }),
      ),
    onDelete: setDeleting,
  });

  const table = useReactTable({
    data: filtered,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { columnPinning: EXAMPLE_MATERIAL_MODEL_COLUMN_PINNING },
  });

  const handleDelete = () => {
    if (!deleting) return;
    if (materials.some((material) => material.modelId === deleting.id)) {
      toast.error('Không thể xóa mẫu đang được vật tư sử dụng.');
      setDeleting(null);
      return;
    }
    removeExampleMaterialModel(deleting.id);
    toast.success(`Đã xóa mẫu “${deleting.name}”.`);
    setDeleting(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title="Quản lý mẫu vật tư"
        icon={Boxes}
        actions={
          <Button asChild variant="primary" size="md">
            <Link to={ROUTES.EXAMPLE.MATERIAL_MODEL_DEMO_CREATE}>
              <Plus />
              Thêm mẫu
            </Link>
          </Button>
        }
      />

      <DataGrid
        table={table}
        recordCount={filtered.length}
        emptyMessage={
          keyword ? 'Không tìm thấy mẫu vật tư phù hợp.' : 'Chưa có mẫu vật tư.'
        }
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            title="Mẫu vật tư"
            toolbar={
              <Input
                aria-label="Tìm mẫu vật tư"
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  table.setPageIndex(0);
                }}
                className="w-full sm:w-64"
              />
            }
          />
          <CardTable className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardTable>
          <CardFooter className="justify-between">
            <DataGridPagination />
          </CardFooter>
        </Card>
      </DataGrid>

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xóa mẫu vật tư"
        description={`Bạn chắc chắn muốn xóa mẫu “${deleting?.name ?? ''}”?`}
        onConfirm={handleDelete}
      />

      <Dialog
        open={viewing !== null}
        onOpenChange={(open) => !open && setViewing(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Thông tin mẫu vật tư</DialogTitle>
          </DialogHeader>
          {viewing ? (
            <div className="space-y-5">
              <MaterialIdentity
                name={viewing.name}
                code={viewing.code}
                imageUrl={viewing.imageUrls[0]}
              />
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Trạng thái">
                  {viewing.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}
                </DetailField>
                <DetailField label="Xuất xứ">
                  {viewing.origin || '—'}
                </DetailField>
                <DetailField label="Ngày tạo">
                  {formatDate(viewing.createdAt)}
                </DetailField>
                <DetailField label="Ngày chỉnh sửa">
                  {formatDate(viewing.updatedAt)}
                </DetailField>
                <DetailField label="Mô tả" className="sm:col-span-2">
                  {viewing.description || '—'}
                </DetailField>
              </dl>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}
