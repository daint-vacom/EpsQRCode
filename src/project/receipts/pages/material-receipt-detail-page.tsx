import { useCallback, useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import type { Custodian } from '@/project/custodians/model/custodian';
import { useHandoversQuery } from '@/project/handover/hooks/use-handovers';
import { HANDOVER_PERMISSION_CODES } from '@/project/handover/model/handover-permissions';
import {
  HANDOVER_DOCUMENT_COLUMN_PINNING,
  useHandoverDocumentColumns,
} from '@/project/handover/table/handover.columns.generated';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  ArrowRightLeft,
  Boxes,
  CircleCheck,
  ClipboardPlus,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTable,
  CardTitle,
} from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { MaterialReceiptDetailLayout } from '../detail/material-receipt-layout.generated';
import {
  useMaterialReceiptActionMutation,
  useMaterialReceiptHistoryQuery,
  useMaterialReceiptItemsQuery,
  useMaterialReceiptQuery,
} from '../hooks/use-material-receipts';
import { MATERIAL_RECEIPT_PERMISSION_CODES } from '../model/material-receipt';
import { useMaterialReceiptItemRowColumns } from '../table/material-receipt-item.columns.generated';

type ReceiptAction = 'confirm' | 'complete' | 'reopen' | 'cancel';

function represents(custodian: Custodian | undefined, userId: string | null) {
  return Boolean(
    userId &&
    custodian &&
    (custodian.accountUserId === userId ||
      custodian.accountUserIds.includes(userId) ||
      custodian.representativeUserId === userId),
  );
}

export function MaterialReceiptDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const { userId, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_RECEIPT_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_RECEIPT_PERMISSION_CODES.manage);
  const canManageHandover = hasPermission(HANDOVER_PERMISSION_CODES.manage);
  const query = useMaterialReceiptQuery(
    id,
    isPermissionsPending || canView || canManage,
  );
  const historyQuery = useMaterialReceiptHistoryQuery(
    id,
    isPermissionsPending || canView || canManage,
  );
  const custodiansQuery = useCustodiansQuery(
    true,
    isPermissionsPending || canView || canManage,
  );
  const [itemPageIndex, setItemPageIndex] = useState(0);
  const [itemPageSize, setItemPageSize] = useState(20);
  const [handoverPageIndex, setHandoverPageIndex] = useState(0);
  const [handoverPageSize, setHandoverPageSize] = useState(20);
  const [actionDialog, setActionDialog] = useState<ReceiptAction | null>(null);
  const [reason, setReason] = useState('');
  const actionMutation = useMaterialReceiptActionMutation();
  const receipt = query.data;
  const custodians = custodiansQuery.data ?? [];
  const warehouse = custodians.find(
    (party) => party.id === receipt?.warehouseId,
  );
  const isWarehouseRepresentative = represents(warehouse, userId);
  const hasRepresentedUnit = custodians.some(
    (party) =>
      party.type !== 'warehouse' && party.isActive && represents(party, userId),
  );
  const canAllocate = Boolean(
    canManageHandover &&
    isWarehouseRepresentative &&
    receipt?.status === 'handover',
  );
  const canRequest = Boolean(
    canManageHandover && hasRepresentedUnit && receipt?.status === 'handover',
  );
  const itemFilters = { page: itemPageIndex + 1, pageSize: itemPageSize };
  const itemsQuery = useMaterialReceiptItemsQuery(
    id,
    itemFilters,
    isPermissionsPending || canView || canManage,
  );
  const handoversQuery = useHandoversQuery(
    { receiptId: id, page: handoverPageIndex + 1, pageSize: handoverPageSize },
    isPermissionsPending || canView || canManage,
  );
  const itemsResult = itemsQuery.data;
  const handoversResult = handoversQuery.data;
  const receiptItems = itemsResult?.items ?? [];
  const handovers = handoversResult?.items ?? [];
  const onViewHandover = useCallback(
    (handover: (typeof handovers)[number]) => {
      navigate(ROUTES.PROJECT.HANDOVER_DETAIL.replace(':id', handover.id));
    },
    [navigate],
  );
  const itemColumns = useMaterialReceiptItemRowColumns();
  const handoverColumns = useHandoverDocumentColumns({
    onView: onViewHandover,
  });
  const itemsTable = useReactTable({
    data: receiptItems,
    columns: itemColumns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil((itemsResult?.total ?? 0) / itemPageSize),
    state: { pagination: { pageIndex: itemPageIndex, pageSize: itemPageSize } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex: itemPageIndex, pageSize: itemPageSize })
          : updater;
      if (next.pageSize !== itemPageSize) {
        setItemPageSize(next.pageSize);
        setItemPageIndex(0);
      } else setItemPageIndex(next.pageIndex);
    },
  });
  const handoversTable = useReactTable({
    data: handovers,
    columns: handoverColumns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil((handoversResult?.total ?? 0) / handoverPageSize),
    state: {
      columnPinning: HANDOVER_DOCUMENT_COLUMN_PINNING,
      pagination: { pageIndex: handoverPageIndex, pageSize: handoverPageSize },
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({
              pageIndex: handoverPageIndex,
              pageSize: handoverPageSize,
            })
          : updater;
      if (next.pageSize !== handoverPageSize) {
        setHandoverPageSize(next.pageSize);
        setHandoverPageIndex(0);
      } else setHandoverPageIndex(next.pageIndex);
    },
  });
  const navigateToHandover = useCallback(
    (mode: 'warehouse_allocation' | 'warehouse_request') => {
      if (!receipt) return;
      const search = new URLSearchParams({
        mode,
        receiptId: receipt.id,
        warehouseId: receipt.warehouseId,
      });
      navigate(
        `${ROUTES.PROJECT.WAREHOUSE_HANDOVER_CREATE}?${search.toString()}`,
      );
    },
    [navigate, receipt],
  );
  const submitAction = () => {
    if (!receipt || !actionDialog) return;
    const nextReason = reason.trim();
    if ((actionDialog === 'cancel' || actionDialog === 'reopen') && !nextReason)
      return;
    actionMutation.mutate(
      {
        id: receipt.id,
        action: actionDialog,
        expectedVersion: receipt.version,
        reason: nextReason,
      },
      {
        onSuccess: () => {
          const toastKey =
            actionDialog === 'confirm'
              ? 'confirmed'
              : actionDialog === 'complete'
                ? 'completed'
                : actionDialog === 'reopen'
                  ? 'reopened'
                  : 'cancelled';
          toast.success(
            intl.formatMessage({ id: `receipts.toasts.${toastKey}` }),
          );
          setActionDialog(null);
          setReason('');
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };
  const actions = useMemo(
    () =>
      receipt ? (
        <div className="flex flex-wrap gap-2">
          {receipt.status === 'draft' && canManage ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() =>
                  navigate(ROUTES.PROJECT.RECEIPT_EDIT.replace(':id', id))
                }
              >
                <Pencil className="size-4" />
                {intl.formatMessage({ id: 'receipts.actions.edit' })}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={actionMutation.isPending}
                onClick={() => {
                  setActionDialog('confirm');
                  setReason('');
                }}
              >
                <CircleCheck className="size-4" />
                {intl.formatMessage({ id: 'receipts.actions.confirm' })}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="md"
                onClick={() => {
                  setActionDialog('cancel');
                  setReason('');
                }}
              >
                <X className="size-4" />
                {intl.formatMessage({ id: 'receipts.actions.cancel' })}
              </Button>
            </>
          ) : null}
          {receipt.status === 'handover' ? (
            <>
              {canManage ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() =>
                    navigate(
                      `${ROUTES.PROJECT.RECEIPT_EDIT.replace(':id', id)}?adjust=1`,
                    )
                  }
                >
                  <Pencil className="size-4" />
                  {intl.formatMessage({ id: 'receipts.actions.adjust' })}
                </Button>
              ) : null}
              {canAllocate ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => navigateToHandover('warehouse_allocation')}
                >
                  <Plus className="size-4" />
                  {intl.formatMessage({
                    id: 'receipts.actions.linkedHandover',
                  })}
                </Button>
              ) : null}
              {canRequest ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => navigateToHandover('warehouse_request')}
                >
                  <ArrowRightLeft className="size-4" />
                  {intl.formatMessage({ id: 'receipts.actions.linkedRequest' })}
                </Button>
              ) : null}
              {canManage ? (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setActionDialog('complete');
                    setReason('');
                  }}
                >
                  <CircleCheck className="size-4" />
                  {intl.formatMessage({ id: 'receipts.actions.complete' })}
                </Button>
              ) : null}
            </>
          ) : null}
          {receipt.status === 'completed' && canManage ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                setActionDialog('reopen');
                setReason('');
              }}
            >
              <RotateCcw className="size-4" />
              {intl.formatMessage({ id: 'receipts.actions.reopen' })}
            </Button>
          ) : null}
        </div>
      ) : null,
    [
      actionMutation.isPending,
      canAllocate,
      canManage,
      canRequest,
      id,
      intl,
      navigate,
      receipt,
      navigateToHandover,
    ],
  );
  const header = useMemo(
    () => ({
      title:
        receipt?.code ??
        intl.formatMessage({ id: 'receipts.detail.defaultTitle' }),
      icon: Boxes,
      showBackButton: true,
      backLabel: intl.formatMessage({ id: 'receipts.actions.back' }),
      onBack: () => navigate(ROUTES.PROJECT.RECEIPTS),
      actions,
    }),
    [actions, intl, navigate, receipt?.code],
  );
  useDetailEntryLayoutHeader(header);

  if (isPermissionsPending)
    return (
      <div className="h-full min-h-0 p-4">
        <div className="h-full animate-pulse rounded-xl bg-muted" />
      </div>
    );
  if (!canView && !canManage)
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({ id: 'receipts.errors.permission' })}
          description={intl.formatMessage({ id: 'receipts.errors.permission' })}
        />
      </div>
    );
  if (query.isPending)
    return (
      <div className="h-full min-h-0 p-4">
        <div className="h-full animate-pulse rounded-xl bg-muted" />
      </div>
    );
  if (query.isError || !receipt)
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({ id: 'receipts.errors.loadDetailTitle' })}
          description={getApiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      </div>
    );

  const profile = (
    <Card>
      <CardContent className="flex flex-col items-center p-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ClipboardPlus className="size-7" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">{receipt.code}</h2>
        <Badge
          className="mt-2"
          variant={
            receipt.status === 'completed'
              ? 'success'
              : receipt.status === 'cancelled'
                ? 'secondary'
                : receipt.status === 'handover'
                  ? 'info'
                  : 'outline'
          }
        >
          {intl.formatMessage({ id: `receipts.status.${receipt.status}` })}
        </Badge>
        <div className="mt-5 w-full border-t border-border pt-4 text-left text-sm">
          <p className="text-muted-foreground">
            {intl.formatMessage({ id: 'receipts.fields.warehouse' })}
          </p>
          <p className="font-medium">{receipt.warehouse.name}</p>
        </div>
      </CardContent>
    </Card>
  );
  const information = (
    <Card>
      <CardHeader>
        <CardTitle>
          {intl.formatMessage({ id: 'receipts.tabs.details' })}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Info
          label={intl.formatMessage({ id: 'receipts.fields.createdAt' })}
          value={new Date(receipt.createdAt).toLocaleString('vi-VN')}
        />
        <Info
          label={intl.formatMessage({ id: 'receipts.fields.total' })}
          value={String(receipt.totalItems)}
        />
        <Info
          label={intl.formatMessage({ id: 'receipts.fields.progress' })}
          value={`${receipt.receivedItems} / ${receipt.totalItems} (${receipt.totalItems ? Math.floor((receipt.receivedItems / receipt.totalItems) * 100) : 0}%)`}
        />
        <Info
          label={intl.formatMessage({ id: 'receipts.fields.note' })}
          value={receipt.note || '—'}
        />
      </CardContent>
    </Card>
  );
  const detailsContent = (
    <div className="space-y-4">
      <Card className="min-h-[28rem] min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>
            {intl.formatMessage({ id: 'receipts.fields.items' })}
          </CardTitle>
        </CardHeader>
        <DataGrid
          table={itemsTable}
          recordCount={itemsResult?.total ?? 0}
          isLoading={itemsQuery.isPending}
          isFetching={itemsQuery.isFetching}
          emptyMessage={intl.formatMessage({ id: 'receipts.empty.items' })}
        >
          <CardTable className="min-h-0 flex-1">
            {itemsQuery.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'receipts.errors.loadItemsTitle',
                })}
                description={getApiErrorMessage(itemsQuery.error)}
                onRetry={() => void itemsQuery.refetch()}
              />
            ) : (
              <ScrollArea className="h-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardTable>
          <CardFooter className="justify-between">
            {!itemsQuery.isError ? <DataGridPagination /> : null}
          </CardFooter>
        </DataGrid>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {intl.formatMessage({ id: 'receipts.history.title' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyQuery.isError ? (
            <ErrorState
              title={intl.formatMessage({ id: 'receipts.history.errors.load' })}
              description={getApiErrorMessage(historyQuery.error)}
              onRetry={() => void historyQuery.refetch()}
            />
          ) : historyQuery.isPending ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : (
            <ol className="space-y-4">
              {(historyQuery.data ?? []).map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {intl.formatMessage({
                        id: `receipts.events.${entry.action}`,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString('vi-VN')}
                      {entry.actorDisplayName
                        ? ` · ${entry.actorDisplayName}`
                        : ''}
                      {entry.reason ? ` · ${entry.reason}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {!historyQuery.isError &&
          !historyQuery.isPending &&
          !historyQuery.data?.length ? (
            <p className="text-sm text-muted-foreground">
              {intl.formatMessage({ id: 'receipts.history.empty' })}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
  const handoversContent = (
    <Card className="min-h-[28rem] min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>
          {intl.formatMessage({ id: 'receipts.tabs.handovers' })}
        </CardTitle>
      </CardHeader>
      <DataGrid
        table={handoversTable}
        recordCount={handoversResult?.total ?? 0}
        isLoading={handoversQuery.isPending}
        isFetching={handoversQuery.isFetching}
        emptyMessage={intl.formatMessage({ id: 'receipts.empty.handovers' })}
      >
        <CardTable className="min-h-0 flex-1">
          {handoversQuery.isError ? (
            <ErrorState
              title={intl.formatMessage({
                id: 'receipts.errors.loadHandoversTitle',
              })}
              description={getApiErrorMessage(handoversQuery.error)}
              onRetry={() => void handoversQuery.refetch()}
            />
          ) : (
            <ScrollArea className="h-full">
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardTable>
        <CardFooter className="justify-between">
          {!handoversQuery.isError ? <DataGridPagination /> : null}
        </CardFooter>
      </DataGrid>
    </Card>
  );

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 lg:p-5">
      <MaterialReceiptDetailLayout
        profile={profile}
        information={information}
        detailsContent={detailsContent}
        handoversContent={handoversContent}
      />
      <Dialog
        open={actionDialog !== null}
        onOpenChange={(open) =>
          !open && !actionMutation.isPending && setActionDialog(null)
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {intl.formatMessage({
                id: actionDialog
                  ? `receipts.dialogs.${actionDialog}Title`
                  : 'receipts.dialogs.confirmTitle',
              })}
            </DialogTitle>
          </DialogHeader>
          {actionDialog === 'complete' ? (
            <p className="text-sm text-muted-foreground">
              {intl.formatMessage({ id: 'receipts.confirm.completeWarning' })}
            </p>
          ) : null}
          {actionDialog === 'cancel' || actionDialog === 'reopen' ? (
            <div className="space-y-2">
              <label
                htmlFor="receipt-action-reason"
                className="text-sm font-medium"
              >
                {intl.formatMessage({
                  id:
                    actionDialog === 'reopen'
                      ? 'receipts.confirm.reopenReason'
                      : 'receipts.confirm.cancelReason',
                })}
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Textarea
                id="receipt-action-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setActionDialog(null)}
            >
              {intl.formatMessage({ id: 'common.actions.cancel' })}
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={actionMutation.isPending}
              loadingText={intl.formatMessage({ id: 'common.state.saving' })}
              disabled={
                (actionDialog === 'cancel' || actionDialog === 'reopen') &&
                !reason.trim()
              }
              onClick={submitAction}
            >
              {intl.formatMessage({
                id: actionDialog
                  ? `receipts.actions.${actionDialog}`
                  : 'receipts.actions.confirm',
              })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}
