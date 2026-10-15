import { useMemo, useState } from 'react';
import { useCodeGenerationPatternsQuery } from '@/project/code-generation/hooks/use-code-generation-patterns';
import { DEFAULT_CODE_GENERATION_PATTERNS } from '@/project/code-generation/model/code-pattern-example';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ClipboardList, Plus } from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridHeaderMenu } from '@/components/ui/data-grid-header-menu';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  mapMaterialSpecificationToFormValues,
  MaterialSpecificationFormDialog,
  useMaterialSpecificationForm,
} from '../forms/material-specification-form.generated';
import {
  useCreateMaterialSpecificationMutation,
  useDeleteMaterialSpecificationMutation,
  useMaterialSpecificationsQuery,
  useUpdateMaterialSpecificationMutation,
} from '../hooks/use-material-specifications';
import type {
  MaterialSpecification,
  MaterialSpecificationFormValues,
} from '../model/material-specification';
import { MATERIAL_SPECIFICATION_PERMISSION_CODES } from '../model/material-specification-permissions';
import {
  MATERIAL_SPECIFICATION_COLUMN_PINNING,
  useMaterialSpecificationColumns,
} from '../table/material-specification.columns.generated';

const EMPTY_SPECIFICATIONS: MaterialSpecification[] = [];

function isAuthorizationError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.response?.status;
  return status === 401 || status === 403;
}

export function MaterialSpecificationsPage() {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_SPECIFICATION_PERMISSION_CODES.view);
  const canManage = hasPermission(
    MATERIAL_SPECIFICATION_PERMISSION_CODES.manage,
  );
  const query = useMaterialSpecificationsQuery(isPermissionsPending || canView);
  const patternsQuery = useCodeGenerationPatternsQuery(
    !isPermissionsPending && canManage,
  );
  const createMutation = useCreateMaterialSpecificationMutation();
  const updateMutation = useUpdateMaterialSpecificationMutation();
  const deleteMutation = useDeleteMaterialSpecificationMutation();
  const createForm = useMaterialSpecificationForm();
  const editForm = useMaterialSpecificationForm();
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialSpecification | null>(null);
  const [deleting, setDeleting] = useState<MaterialSpecification | null>(null);
  const codePattern =
    patternsQuery.data?.find(
      (pattern) => pattern.entityKey === 'material_specification',
    )?.pattern ?? DEFAULT_CODE_GENERATION_PATTERNS.material_specification;

  const specifications = query.data ?? EMPTY_SPECIFICATIONS;
  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase('vi');
    if (!normalized) return specifications;
    return specifications.filter((item) =>
      [item.code, item.name].some((value) =>
        value.toLocaleLowerCase('vi').includes(normalized),
      ),
    );
  }, [keyword, specifications]);

  const closeCreate = (open: boolean) => {
    setCreateOpen(open);
  };

  const submitCreate = (values: MaterialSpecificationFormValues) => {
    if (!canManage) return;
    createMutation.mutate(values, {
      onSuccess: () => {
        toast.success(
          intl.formatMessage({ id: 'materialSpecifications.toasts.created' }),
        );
        createForm.reset();
        closeCreate(false);
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });
  };

  const submitEdit = (values: MaterialSpecificationFormValues) => {
    if (!canManage || !editing) return;
    updateMutation.mutate(
      { id: editing.id, values },
      {
        onSuccess: () => {
          toast.success(
            intl.formatMessage({ id: 'materialSpecifications.toasts.updated' }),
          );
          setEditing(null);
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  const confirmDelete = () => {
    if (!canManage || !deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(
          intl.formatMessage(
            { id: 'materialSpecifications.toasts.deleted' },
            { name: deleting.name },
          ),
        );
        setDeleting(null);
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });
  };

  const columns = useMaterialSpecificationColumns({
    canManage,
    onEdit: (item) => {
      editForm.reset(mapMaterialSpecificationToFormValues(item));
      setEditing(item);
    },
    onDelete: setDeleting,
  });
  const table = useReactTable({
    data: filtered,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { columnPinning: MATERIAL_SPECIFICATION_COLUMN_PINNING },
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'materialSpecifications.page.header' })}
        icon={ClipboardList}
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
            >
              <Plus />
              {intl.formatMessage({
                id: 'materialSpecifications.actions.create',
              })}
            </Button>
          ) : null
        }
      />

      <DataGrid
        table={table}
        recordCount={filtered.length}
        isLoading={isPermissionsPending || (canView && query.isPending)}
        isFetching={query.isFetching}
        emptyMessage={intl.formatMessage({
          id: keyword
            ? 'materialSpecifications.empty.search'
            : 'materialSpecifications.empty.list',
        })}
        tableLayout={{ dense: true }}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel="thông số"
            stats={
              <Input
                aria-label={intl.formatMessage({
                  id: 'materialSpecifications.filters.searchPlaceholder',
                })}
                placeholder={intl.formatMessage({
                  id: 'materialSpecifications.filters.searchPlaceholder',
                })}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  table.setPageIndex(0);
                }}
                className="w-full sm:w-72"
              />
            }
            toolbar={<DataGridHeaderMenu table={table} />}
          />
          <CardTable className="min-h-0 flex-1">
            {!isPermissionsPending && !canView ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'materialSpecifications.errors.authorizationTitle',
                })}
                description={intl.formatMessage({
                  id: 'materialSpecifications.errors.authorization',
                })}
              />
            ) : query.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'materialSpecifications.errors.loadTitle',
                })}
                description={
                  isAuthorizationError(query.error)
                    ? intl.formatMessage({
                        id: 'materialSpecifications.errors.authorization',
                      })
                    : getApiErrorMessage(query.error)
                }
                onRetry={() => void query.refetch()}
              />
            ) : (
              <ScrollArea className="h-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardTable>
          <CardFooter className="justify-between">
            {canView && !isPermissionsPending && !query.isError ? (
              <DataGridPagination />
            ) : null}
          </CardFooter>
        </Card>
      </DataGrid>

      <MaterialSpecificationFormDialog
        open={createOpen}
        onOpenChange={closeCreate}
        mode="create"
        form={createForm}
        onSubmit={submitCreate}
        pattern={codePattern}
        isSaving={createMutation.isPending}
        title={intl.formatMessage({
          id: 'materialSpecifications.dialogs.createTitle',
        })}
      />
      <MaterialSpecificationFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        form={editForm}
        onSubmit={submitEdit}
        pattern={codePattern}
        resetKey={editing?.id}
        isSaving={updateMutation.isPending}
        title={intl.formatMessage({
          id: 'materialSpecifications.dialogs.editTitle',
        })}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={intl.formatMessage({
          id: 'materialSpecifications.dialogs.deleteTitle',
        })}
        description={intl.formatMessage(
          { id: 'materialSpecifications.dialogs.deleteDescription' },
          { name: deleting?.name ?? '' },
        )}
        confirmLabel={intl.formatMessage({
          id: 'materialSpecifications.dialogs.deleteConfirm',
        })}
        confirmVariant="destructive"
        isConfirming={deleteMutation.isPending}
        closeOnConfirm={false}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
