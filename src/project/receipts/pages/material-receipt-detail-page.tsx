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
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { PaginationState, RowSelectionState } from '@tanstack/react-table';
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { SelectionActionBar } from '@/components/ui/selection-action-bar';
import type { SelectionActionOption } from '@/components/ui/selection-action-bar';
import { Textarea } from '@/components/ui/textarea';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { MaterialReceiptLineMaterialDrawer } from '../components/material-receipt-line-material-drawer';
import { MaterialReceiptDetailLayout } from '../detail/material-receipt-layout.generated';
import { mapMaterialReceiptToFormValues } from '../forms/material-receipt-form.generated';
import {
  useApplyMaterialReceiptAdjustmentMutation,
  useMaterialReceiptActionMutation,
  useMaterialReceiptAdjustmentPreviewMutation,
  useMaterialReceiptHistoryQuery,
  useMaterialReceiptQuery,
  useSaveMaterialReceiptMutation,
} from '../hooks/use-material-receipts';
import {
  MATERIAL_RECEIPT_PERMISSION_CODES,
  toMaterialReceiptLineInputs,
} from '../model/material-receipt';
import type {
  MaterialReceiptAdjustmentPreview,
  MaterialReceiptFormLine,
  MaterialReceiptLine,
} from '../model/material-receipt';
import {
  MATERIAL_RECEIPT_LINE_COLUMN_PINNING,
  useMaterialReceiptLineColumns,
} from '../table/material-receipt-line.columns.generated';

type ReceiptAction = 'confirm' | 'complete' | 'reopen' | 'cancel';
type ReceiptBulkAction = 'edit' | 'delete' | 'duplicate';

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
  const [itemPagination, setItemPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [itemRowSelection, setItemRowSelection] = useState<RowSelectionState>(
    {},
  );
  const [handoverPageIndex, setHandoverPageIndex] = useState(0);
  const [handoverPageSize, setHandoverPageSize] = useState(20);
  const [actionDialog, setActionDialog] = useState<ReceiptAction | null>(null);
  const [reason, setReason] = useState('');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<ReceiptBulkAction>('edit');
  const [bulkQuantity, setBulkQuantity] = useState('');
  const [bulkCondition, setBulkCondition] = useState('');
  const [bulkConditionNote, setBulkConditionNote] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [adjustmentPreview, setAdjustmentPreview] =
    useState<MaterialReceiptAdjustmentPreview | null>(null);
  const [adjustmentLines, setAdjustmentLines] = useState<
    ReturnType<typeof toMaterialReceiptLineInputs>
  >([]);
  const [confirmedHandoverIds, setConfirmedHandoverIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [activeMaterialLine, setActiveMaterialLine] =
    useState<MaterialReceiptLine | null>(null);
  const actionMutation = useMaterialReceiptActionMutation();
  const saveMutation = useSaveMaterialReceiptMutation();
  const previewMutation = useMaterialReceiptAdjustmentPreviewMutation();
  const applyMutation = useApplyMaterialReceiptAdjustmentMutation();
  const receipt = query.data;
  const canEditReceiptLines = Boolean(
    canManage &&
    (receipt?.status === 'draft' || receipt?.status === 'handover'),
  );
  const saveBusy =
    saveMutation.isPending ||
    previewMutation.isPending ||
    applyMutation.isPending;
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
  const handoversQuery = useHandoversQuery(
    { receiptId: id, page: handoverPageIndex + 1, pageSize: handoverPageSize },
    isPermissionsPending || canView || canManage,
  );
  const handoversResult = handoversQuery.data;
  const receiptItems = (receipt?.lines ?? []).filter((line) =>
    line.items.some((item) => item.status === 'active'),
  );
  const handovers = handoversResult?.items ?? [];
  const onViewHandover = useCallback(
    (handover: (typeof handovers)[number]) => {
      navigate(ROUTES.PROJECT.HANDOVER_DETAIL.replace(':id', handover.id));
    },
    [navigate],
  );
  const itemColumns = useMaterialReceiptLineColumns({
    canEdit: canEditReceiptLines,
    onEditMaterial: setActiveMaterialLine,
  });
  const handoverColumns = useHandoverDocumentColumns({
    onView: onViewHandover,
  });
  const itemsTable = useReactTable({
    data: receiptItems,
    columns: itemColumns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: canEditReceiptLines,
    state: {
      columnPinning: MATERIAL_RECEIPT_LINE_COLUMN_PINNING,
      columnVisibility: {
        select: canEditReceiptLines,
        actions: canEditReceiptLines,
      },
      pagination: itemPagination,
      rowSelection: itemRowSelection,
    },
    onPaginationChange: setItemPagination,
    onRowSelectionChange: setItemRowSelection,
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
  const selectedLineIds = Object.entries(itemRowSelection)
    .filter(([, selected]) => selected)
    .map(([lineId]) => lineId);
  const selectedLineSet = new Set(selectedLineIds);
  const bulkActionOptions: SelectionActionOption[] = [
    {
      value: 'edit',
      label: intl.formatMessage({ id: 'receipts.bulk.edit' }),
      icon: 'edit',
    },
    {
      value: 'delete',
      label: intl.formatMessage({ id: 'receipts.bulk.delete' }),
      icon: 'delete',
      destructive: true,
    },
    {
      value: 'duplicate',
      label: intl.formatMessage({ id: 'receipts.bulk.duplicate' }),
      icon: 'copy',
    },
  ];

  const openBulkAction = (action: string) => {
    setBulkAction(action as ReceiptBulkAction);
    setBulkQuantity('');
    setBulkCondition('');
    setBulkConditionNote('');
    setBulkReason('');
    setBulkDialogOpen(true);
  };

  const previewLinesForAdjustment = (
    lines: ReturnType<typeof toMaterialReceiptLineInputs>,
    reasonText: string,
    onSuccess?: () => void,
  ) => {
    if (!receipt) return;
    setBulkReason(reasonText);
    previewMutation.mutate(
      { id: receipt.id, expectedVersion: receipt.version, lines },
      {
        onSuccess: (result) => {
          setAdjustmentPreview(result);
          setAdjustmentLines(lines);
          setConfirmedHandoverIds(new Set());
          onSuccess?.();
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  const persistDraftLines = (
    lines: ReturnType<typeof toMaterialReceiptLineInputs>,
    onSuccess?: () => void,
  ) => {
    if (!receipt) return;
    saveMutation.mutate(
      {
        id: receipt.id,
        values: {
          warehouseId: receipt.warehouseId,
          note: receipt.note,
          expectedVersion: receipt.version,
          lines,
        },
      },
      {
        onSuccess: () => {
          toast.success(intl.formatMessage({ id: 'receipts.toasts.updated' }));
          setItemRowSelection({});
          onSuccess?.();
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  const applyBulkAction = () => {
    if (!receipt || !selectedLineIds.length) return;
    const values = mapMaterialReceiptToFormValues(receipt);
    const selectedLines = values.lines.filter((line) =>
      selectedLineSet.has(line.lineId),
    );
    let nextLines: MaterialReceiptFormLine[];
    if (bulkAction === 'delete') {
      nextLines = values.lines.filter(
        (line) => !selectedLineSet.has(line.lineId),
      );
    } else if (bulkAction === 'duplicate') {
      const copies = selectedLines.map((line) => ({
        ...line,
        clientId: crypto.randomUUID(),
        lineId: '',
        items: Array.from({ length: line.quantity }, (_, index) => {
          const source = line.items[index];
          const condition = source?.condition ?? line.condition;
          return {
            serialNumber: '',
            condition,
            conditionNote:
              condition === 'damaged'
                ? (source?.conditionNote ?? line.conditionNote)
                : '',
            note: '',
          };
        }),
      }));
      nextLines = [...values.lines, ...copies];
    } else {
      const quantity = bulkQuantity.trim() ? Number(bulkQuantity) : null;
      if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1)) {
        toast.error(intl.formatMessage({ id: 'receipts.errors.quantity' }));
        return;
      }
      if (bulkCondition === 'damaged' && !bulkConditionNote.trim()) {
        toast.error(
          intl.formatMessage({ id: 'receipts.errors.conditionNote' }),
        );
        return;
      }
      nextLines = values.lines.map((line) => {
        if (!selectedLineSet.has(line.lineId)) return line;
        const nextQuantity = quantity ?? line.quantity;
        const nextCondition =
          bulkCondition === 'good' || bulkCondition === 'damaged'
            ? bulkCondition
            : null;
        const nextConditionNote = nextCondition
          ? nextCondition === 'damaged'
            ? bulkConditionNote.trim()
            : ''
          : line.conditionNote;
        const currentItems = Array.from(
          { length: nextQuantity },
          (_, index) =>
            line.items[index] ?? {
              serialNumber: '',
              condition: nextCondition ?? line.condition,
              conditionNote: nextConditionNote,
              note: '',
            },
        );
        return {
          ...line,
          quantity: nextQuantity,
          condition: nextCondition ?? line.condition,
          conditionNote: nextConditionNote,
          items: nextCondition
            ? currentItems.map((item) => ({
                ...item,
                condition: nextCondition,
                conditionNote: nextConditionNote,
              }))
            : currentItems,
        };
      });
    }
    const nextValues = { ...values, lines: nextLines };
    const lines = toMaterialReceiptLineInputs(
      nextValues,
      receipt.status === 'handover',
      true,
    );
    if (receipt.status === 'draft') {
      persistDraftLines(lines, () => setBulkDialogOpen(false));
    } else {
      if (!bulkReason.trim()) return;
      previewLinesForAdjustment(lines, bulkReason.trim(), () =>
        setBulkDialogOpen(false),
      );
    }
  };

  const saveMaterialSpecifications = (
    values: Record<string, string[]>,
    labels: Record<string, string[]>,
    reasonText?: string,
  ) => {
    if (!receipt || !activeMaterialLine) return;
    const receiptValues = mapMaterialReceiptToFormValues(receipt);
    const line = receiptValues.lines.find(
      (candidate) => candidate.lineId === activeMaterialLine.id,
    );
    if (!line) return;
    line.specificationOverrides = values;
    line.specificationOverrideLabels = labels;
    const lines = toMaterialReceiptLineInputs(
      receiptValues,
      receipt.status === 'handover',
      true,
    );
    if (receipt.status === 'draft') {
      persistDraftLines(lines, () => setActiveMaterialLine(null));
    } else if (receipt.status === 'handover' && reasonText?.trim()) {
      previewLinesForAdjustment(lines, reasonText.trim(), () =>
        setActiveMaterialLine(null),
      );
    }
  };

  const applyAdjustment = () => {
    if (!receipt || !adjustmentPreview || !bulkReason.trim()) return;
    applyMutation.mutate(
      {
        id: receipt.id,
        expectedVersion: receipt.version,
        previewToken: adjustmentPreview.previewToken,
        lines: adjustmentLines,
        reason: bulkReason.trim(),
        cancelHandoverIds: adjustmentPreview.affectedHandovers.map(
          (handover) => handover.id,
        ),
      },
      {
        onSuccess: () => {
          toast.success(intl.formatMessage({ id: 'receipts.toasts.adjusted' }));
          setAdjustmentPreview(null);
          setItemRowSelection({});
          setBulkReason('');
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };
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
  const itemsContent = (
    <Card className="min-h-[28rem] min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>
          {intl.formatMessage({ id: 'receipts.fields.items' })}
        </CardTitle>
      </CardHeader>
      <DataGrid
        table={itemsTable}
        recordCount={receiptItems.length}
        emptyMessage={intl.formatMessage({ id: 'receipts.empty.items' })}
      >
        {canEditReceiptLines && selectedLineIds.length ? (
          <SelectionActionBar
            ariaLabel={intl.formatMessage({ id: 'receipts.bulk.toolbar' })}
            selectionLabel={intl.formatMessage(
              { id: 'receipts.bulk.selected' },
              { count: selectedLineIds.length },
            )}
            actionLabel={intl.formatMessage({ id: 'receipts.bulk.action' })}
            actionPlaceholder={intl.formatMessage({
              id: 'receipts.bulk.action',
            })}
            actions={bulkActionOptions}
            action={bulkAction}
            onActionChange={(value) =>
              setBulkAction(value as ReceiptBulkAction)
            }
            applyLabel={intl.formatMessage({ id: 'receipts.bulk.apply' })}
            onApply={openBulkAction}
            applyDisabled={!selectedLineIds.length || saveBusy}
            onClear={() => setItemRowSelection({})}
            clearLabel={intl.formatMessage({ id: 'receipts.bulk.clear' })}
          />
        ) : null}
        <CardTable className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <DataGridTable />
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardTable>
        <CardFooter className="justify-between">
          <DataGridPagination />
        </CardFooter>
      </DataGrid>
    </Card>
  );
  const handoversContent = (
    <div className="space-y-4">
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

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 lg:p-5">
      <MaterialReceiptDetailLayout
        profile={profile}
        information={information}
        itemsContent={itemsContent}
        allocationContent={handoversContent}
      />
      <MaterialReceiptLineMaterialDrawer
        open={activeMaterialLine !== null}
        onOpenChange={(open) => !open && setActiveMaterialLine(null)}
        line={activeMaterialLine}
        requiresReason={receipt.status === 'handover'}
        isSaving={saveBusy}
        onSave={saveMaterialSpecifications}
      />
      <Dialog
        open={bulkDialogOpen}
        onOpenChange={(open) => !saveBusy && setBulkDialogOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {intl.formatMessage({ id: `receipts.bulk.${bulkAction}Title` })}
            </DialogTitle>
          </DialogHeader>
          {bulkAction === 'edit' ? (
            <div className="space-y-4">
              <label className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                <span className="text-sm font-medium">
                  {intl.formatMessage({ id: 'receipts.fields.quantity' })}
                </span>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  value={bulkQuantity}
                  onChange={(event) => setBulkQuantity(event.target.value)}
                  aria-label={intl.formatMessage({
                    id: 'receipts.fields.quantity',
                  })}
                />
              </label>
              <label className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                <span className="text-sm font-medium">
                  {intl.formatMessage({ id: 'receipts.fields.unitCondition' })}
                </span>
                <OptionSelect
                  value={bulkCondition}
                  onChange={setBulkCondition}
                  placeholder={intl.formatMessage({
                    id: 'receipts.bulk.keepValue',
                  })}
                  ariaLabel={intl.formatMessage({
                    id: 'receipts.fields.unitCondition',
                  })}
                  searchable={false}
                  options={[
                    {
                      value: 'good',
                      label: intl.formatMessage({
                        id: 'project.handover.condition.good',
                      }),
                    },
                    {
                      value: 'damaged',
                      label: intl.formatMessage({
                        id: 'project.handover.condition.damaged',
                      }),
                    },
                  ]}
                />
              </label>
              {bulkCondition === 'damaged' ? (
                <label className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
                  <span className="pt-2 text-sm font-medium">
                    {intl.formatMessage({
                      id: 'receipts.fields.conditionNote',
                    })}
                  </span>
                  <Textarea
                    rows={2}
                    value={bulkConditionNote}
                    onChange={(event) =>
                      setBulkConditionNote(event.target.value)
                    }
                  />
                </label>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {intl.formatMessage(
                { id: `receipts.bulk.${bulkAction}Description` },
                { count: selectedLineIds.length },
              )}
            </p>
          )}
          {receipt.status === 'handover' ? (
            <label className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
              <span className="pt-2 text-sm font-medium">
                {intl.formatMessage({ id: 'receipts.fields.reason' })}
                <span className="ml-1 text-destructive">*</span>
              </span>
              <Textarea
                rows={2}
                value={bulkReason}
                onChange={(event) => setBulkReason(event.target.value)}
              />
            </label>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkDialogOpen(false)}
            >
              {intl.formatMessage({ id: 'common.actions.cancel' })}
            </Button>
            <Button
              type="button"
              variant={bulkAction === 'delete' ? 'destructive' : 'primary'}
              loading={saveBusy}
              loadingText={intl.formatMessage({ id: 'common.state.saving' })}
              disabled={
                (receipt.status === 'handover' && !bulkReason.trim()) ||
                (bulkAction === 'edit' &&
                  !bulkQuantity.trim() &&
                  !bulkCondition) ||
                (bulkAction === 'edit' &&
                  bulkCondition === 'damaged' &&
                  !bulkConditionNote.trim())
              }
              onClick={applyBulkAction}
            >
              {intl.formatMessage({ id: `receipts.bulk.${bulkAction}` })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={adjustmentPreview !== null}
        onOpenChange={(open) =>
          !open && !applyMutation.isPending && setAdjustmentPreview(null)
        }
      >
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {intl.formatMessage({ id: 'receipts.dialogs.adjustmentTitle' })}
            </DialogTitle>
          </DialogHeader>
          {adjustmentPreview ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Summary
                  label={intl.formatMessage({
                    id: 'receipts.adjustment.addCount',
                  })}
                  value={String(adjustmentPreview.addCount)}
                />
                <Summary
                  label={intl.formatMessage({
                    id: 'receipts.adjustment.removeCount',
                  })}
                  value={String(adjustmentPreview.removeCount)}
                />
              </div>
              <section>
                <h3 className="text-sm font-semibold">
                  {intl.formatMessage({
                    id: 'receipts.adjustment.affectedHandovers',
                  })}
                </h3>
                {adjustmentPreview.affectedHandovers.length ? (
                  <div className="mt-2 space-y-2">
                    {adjustmentPreview.affectedHandovers.map((handover) => (
                      <label
                        key={handover.id}
                        className="flex items-start gap-3 rounded-md border border-border p-3 text-sm"
                      >
                        <Checkbox
                          checked={confirmedHandoverIds.has(handover.id)}
                          onCheckedChange={(checked) =>
                            setConfirmedHandoverIds((current) => {
                              const next = new Set(current);
                              if (checked === true) next.add(handover.id);
                              else next.delete(handover.id);
                              return next;
                            })
                          }
                        />
                        <span>
                          {handover.code} · {handover.status}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {intl.formatMessage({
                      id: 'receipts.adjustment.keepHandovers',
                    })}
                  </p>
                )}
              </section>
              {adjustmentPreview.blockedItems.length ? (
                <section>
                  <h3 className="text-sm font-semibold text-destructive">
                    {intl.formatMessage({
                      id: 'receipts.adjustment.blockedItems',
                    })}
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {adjustmentPreview.blockedItems.map((item) => (
                      <li key={item.receiptItemId}>
                        {item.code} · {item.reason}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {intl.formatMessage({ id: 'receipts.adjustment.reload' })}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdjustmentPreview(null)}
            >
              {intl.formatMessage({ id: 'common.actions.cancel' })}
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={applyMutation.isPending}
              loadingText={intl.formatMessage({
                id: 'receipts.actions.applyAdjustment',
              })}
              disabled={
                !adjustmentPreview ||
                adjustmentPreview.blockedItems.length > 0 ||
                confirmedHandoverIds.size !==
                  adjustmentPreview.affectedHandovers.length
              }
              onClick={applyAdjustment}
            >
              {intl.formatMessage({ id: 'receipts.actions.applyAdjustment' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
