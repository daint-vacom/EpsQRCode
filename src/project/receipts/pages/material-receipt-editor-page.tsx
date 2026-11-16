import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useMaterialModelsQuery } from '@/project/material-models/hooks/use-material-models';
import { useWarehousesQuery } from '@/project/warehouses/hooks/use-warehouses';
import { ClipboardPlus, Save } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { MaterialReceiptLineMaterialDrawer } from '../components/material-receipt-line-material-drawer';
import {
  mapMaterialReceiptToFormValues,
  MaterialReceiptHeaderForm,
  useMaterialReceiptForm,
} from '../forms/material-receipt-form.generated';
import {
  useApplyMaterialReceiptAdjustmentMutation,
  useMaterialReceiptAdjustmentPreviewMutation,
  useMaterialReceiptQuery,
  useSaveMaterialReceiptMutation,
} from '../hooks/use-material-receipts';
import type {
  MaterialReceiptAdjustmentPreview,
  MaterialReceiptFormValues,
  MaterialReceiptLineInput,
} from '../model/material-receipt';
import {
  createMaterialReceiptLine,
  MATERIAL_RECEIPT_PERMISSION_CODES,
  toMaterialReceiptLineInputs,
} from '../model/material-receipt';
import { MaterialReceiptLinesEditorTable } from '../table/material-receipt-lines-editor-table.generated';

export function MaterialReceiptEditorPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isAdjustment = searchParams.get('adjust') === '1';
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canManage = hasPermission(MATERIAL_RECEIPT_PERMISSION_CODES.manage);
  const query = useMaterialReceiptQuery(
    id,
    Boolean(id) && (isPermissionsPending || canManage),
  );
  const warehousesQuery = useWarehousesQuery(
    false,
    isPermissionsPending || canManage,
  );
  const modelsQuery = useMaterialModelsQuery(isPermissionsPending || canManage);
  const saveMutation = useSaveMaterialReceiptMutation();
  const previewMutation = useMaterialReceiptAdjustmentPreviewMutation();
  const applyMutation = useApplyMaterialReceiptAdjustmentMutation();
  const form = useMaterialReceiptForm();
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [preview, setPreview] =
    useState<MaterialReceiptAdjustmentPreview | null>(null);
  const [previewLines, setPreviewLines] = useState<MaterialReceiptLineInput[]>(
    [],
  );
  const [activeMaterialLine, setActiveMaterialLine] = useState<number | null>(
    null,
  );
  const [confirmedHandoverIds, setConfirmedHandoverIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const loadedId = useRef('');
  const receipt = query.data;
  const warehouses = warehousesQuery.data ?? [];
  const modelById = useMemo(() => {
    const models = new Map<
      string,
      { name: string; code: string; imageUrl?: string | null }
    >();
    for (const line of receipt?.lines ?? []) {
      if (!line.modelId) continue;
      models.set(line.modelId, {
        name: line.model.name,
        code: line.model.code ?? '',
      });
    }
    for (const model of modelsQuery.data ?? []) {
      models.set(model.id, {
        name: model.name,
        code: model.code,
        imageUrl: model.imageUrl,
      });
    }
    return models;
  }, [modelsQuery.data, receipt?.lines]);
  const saveBusy =
    saveMutation.isPending ||
    previewMutation.isPending ||
    applyMutation.isPending;
  const pageReady =
    !isPermissionsPending && (!id || (!query.isPending && Boolean(receipt)));
  const navigateBack = useCallback(
    () =>
      navigate(
        id
          ? ROUTES.PROJECT.RECEIPT_DETAIL.replace(':id', id)
          : ROUTES.PROJECT.RECEIPTS,
      ),
    [id, navigate],
  );

  useEffect(() => {
    if (!receipt || loadedId.current === receipt.id) return;
    form.reset(mapMaterialReceiptToFormValues(receipt));
    loadedId.current = receipt.id;
  }, [form, receipt]);

  const onSubmit = (values: MaterialReceiptFormValues) => {
    if (!canManage) return;
    const lines = toMaterialReceiptLineInputs(values, isAdjustment);
    if (isAdjustment) {
      if (!adjustmentReason.trim()) {
        toast.error(
          intl.formatMessage({ id: 'receipts.errors.adjustmentReason' }),
        );
        return;
      }
      if (!receipt) return;
      previewMutation.mutate(
        { id: receipt.id, expectedVersion: receipt.version, lines },
        {
          onSuccess: (result) => {
            setPreview(result);
            setPreviewLines(lines);
            setConfirmedHandoverIds(new Set());
          },
          onError: (error) => toast.error(getApiErrorMessage(error)),
        },
      );
      return;
    }
    saveMutation.mutate(
      {
        id: id || null,
        values: {
          warehouseId: values.warehouseId,
          note: values.note,
          ...(receipt ? { expectedVersion: receipt.version } : {}),
          lines: toMaterialReceiptLineInputs(values, false),
        },
      },
      {
        onSuccess: (savedId) => {
          toast.success(
            intl.formatMessage({
              id: receipt
                ? 'receipts.toasts.updated'
                : 'receipts.toasts.created',
            }),
          );
          navigate(ROUTES.PROJECT.RECEIPT_DETAIL.replace(':id', savedId));
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  const header = useMemo(
    () => ({
      title:
        receipt?.code ??
        intl.formatMessage({ id: 'receipts.dialogs.formTitle' }),
      icon: ClipboardPlus,
      showBackButton: true,
      backLabel: intl.formatMessage({ id: 'receipts.actions.back' }),
      onBack: navigateBack,
      actions: (
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Button
              type="submit"
              form="materialReceipt-form"
              variant="primary"
              size="md"
              loading={saveBusy}
              loadingText={intl.formatMessage({
                id: isAdjustment
                  ? 'receipts.actions.previewAdjustment'
                  : 'receipts.actions.saveDraft',
              })}
              disabled={isAdjustment && !adjustmentReason.trim()}
            >
              <Save className="size-4" />
              {intl.formatMessage({
                id: isAdjustment
                  ? 'receipts.actions.previewAdjustment'
                  : 'receipts.actions.saveDraft',
              })}
            </Button>
          ) : null}
        </div>
      ),
    }),
    [
      adjustmentReason,
      canManage,
      intl,
      isAdjustment,
      navigateBack,
      receipt?.code,
      saveBusy,
    ],
  );
  useDetailEntryLayoutHeader(header);

  if (isPermissionsPending) {
    return (
      <div className="h-full min-h-0 p-4">
        <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }
  if (!canManage) {
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({ id: 'receipts.errors.permission' })}
          description={intl.formatMessage({ id: 'receipts.errors.permission' })}
        />
      </div>
    );
  }
  if (id && query.isPending) {
    return (
      <div className="h-full min-h-0 p-4">
        <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }
  if (id && (query.isError || !receipt)) {
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({ id: 'receipts.errors.loadDetailTitle' })}
          description={getApiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (!pageReady)
    return <div className="h-full min-h-0 animate-pulse bg-muted" />;
  if (receipt && !isAdjustment && receipt.status !== 'draft') {
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({ id: 'receipts.errors.editDraftOnly' })}
          description={intl.formatMessage({
            id: 'receipts.errors.editDraftOnly',
          })}
        />
      </div>
    );
  }
  if (receipt && isAdjustment && receipt.status !== 'handover') {
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({ id: 'receipts.errors.editDraftOnly' })}
          description={intl.formatMessage({
            id: 'receipts.errors.editDraftOnly',
          })}
        />
      </div>
    );
  }

  const createLine = createMaterialReceiptLine;
  const selectedDrawerFormLine =
    activeMaterialLine === null
      ? null
      : form.watch(`lines.${activeMaterialLine}`);
  const selectedDrawerModel = modelsQuery.data?.find(
    (model) => model.id === selectedDrawerFormLine?.modelId,
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:p-5">
      {isAdjustment ? (
        <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
          <label
            htmlFor="receipt-adjustment-reason"
            className="text-sm font-medium"
          >
            {intl.formatMessage({ id: 'receipts.fields.reason' })}
            <span className="ml-1 text-destructive">*</span>
          </label>
          <Input
            id="receipt-adjustment-reason"
            value={adjustmentReason}
            onChange={(event) => setAdjustmentReason(event.target.value)}
            aria-invalid={!adjustmentReason.trim()}
          />
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>
            {intl.formatMessage({ id: 'receipts.tabs.details' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {warehousesQuery.isError ? (
            <ErrorState
              title={intl.formatMessage({ id: 'warehouses.errors.loadTitle' })}
              description={getApiErrorMessage(warehousesQuery.error)}
              onRetry={() => void warehousesQuery.refetch()}
            />
          ) : null}
          <MaterialReceiptHeaderForm
            form={form}
            onSubmit={(values) => onSubmit(values)}
            warehouses={warehouses}
          />
        </CardContent>
      </Card>
      <Card className="min-h-[26rem] min-w-0 flex-1 overflow-hidden">
        <MaterialReceiptLinesEditorTable
          form={form}
          createLine={createLine}
          modelById={modelById}
          onEditMaterial={setActiveMaterialLine}
          onCopySelected={(rows) => {
            const copies = rows.map((line) => ({
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
            form.setValue('lines', [...form.getValues('lines'), ...copies], {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        />
      </Card>
      <MaterialReceiptLineMaterialDrawer
        open={activeMaterialLine !== null}
        onOpenChange={(open) => !open && setActiveMaterialLine(null)}
        line={
          selectedDrawerFormLine && selectedDrawerModel
            ? {
                model: {
                  name: selectedDrawerModel.name,
                  specifications: selectedDrawerModel.specifications,
                },
                quantity: selectedDrawerFormLine.quantity,
                specificationOverrides:
                  selectedDrawerFormLine.specificationOverrides,
                specificationOverrideLabels:
                  selectedDrawerFormLine.specificationOverrideLabels,
              }
            : null
        }
        model={selectedDrawerModel}
        isSaving={saveBusy}
        onSave={(values, labels) => {
          if (activeMaterialLine === null) return;
          form.setValue(
            `lines.${activeMaterialLine}.specificationOverrides`,
            values,
            { shouldDirty: true, shouldValidate: true },
          );
          form.setValue(
            `lines.${activeMaterialLine}.specificationOverrideLabels`,
            labels,
            { shouldDirty: true, shouldValidate: true },
          );
          setActiveMaterialLine(null);
        }}
      />
      <Dialog
        open={preview !== null}
        onOpenChange={(open) =>
          !open && !applyMutation.isPending && setPreview(null)
        }
      >
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {intl.formatMessage({ id: 'receipts.dialogs.adjustmentTitle' })}
            </DialogTitle>
          </DialogHeader>
          {preview ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Summary
                  label={intl.formatMessage({
                    id: 'receipts.adjustment.addCount',
                  })}
                  value={String(preview.addCount)}
                />
                <Summary
                  label={intl.formatMessage({
                    id: 'receipts.adjustment.removeCount',
                  })}
                  value={String(preview.removeCount)}
                />
              </div>
              <section>
                <h3 className="text-sm font-semibold">
                  {intl.formatMessage({
                    id: 'receipts.adjustment.affectedHandovers',
                  })}
                </h3>
                {preview.affectedHandovers.length ? (
                  <div className="mt-2 space-y-2">
                    {preview.affectedHandovers.map((handover) => (
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
                          {handover.code} ·{' '}
                          {intl.formatMessage({
                            id: `project.handover.status.${handover.status}`,
                          })}
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {intl.formatMessage({
                              id: 'receipts.adjustment.confirmHandover',
                            })}
                          </span>
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
              {preview.blockedItems.length ? (
                <section>
                  <h3 className="text-sm font-semibold text-destructive">
                    {intl.formatMessage({
                      id: 'receipts.adjustment.blockedItems',
                    })}
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {preview.blockedItems.map((item) => (
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
              onClick={() => setPreview(null)}
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
                !preview ||
                preview.blockedItems.length > 0 ||
                confirmedHandoverIds.size !== preview.affectedHandovers.length
              }
              onClick={() => {
                if (!receipt || !preview) return;
                applyMutation.mutate(
                  {
                    id: receipt.id,
                    expectedVersion: receipt.version,
                    previewToken: preview.previewToken,
                    lines: previewLines,
                    reason: adjustmentReason.trim(),
                    cancelHandoverIds: preview.affectedHandovers.map(
                      (handover) => handover.id,
                    ),
                  },
                  {
                    onSuccess: () => {
                      toast.success(
                        intl.formatMessage({ id: 'receipts.toasts.adjusted' }),
                      );
                      navigate(
                        ROUTES.PROJECT.RECEIPT_DETAIL.replace(
                          ':id',
                          receipt.id,
                        ),
                      );
                    },
                    onError: (error) => toast.error(getApiErrorMessage(error)),
                  },
                );
              }}
            >
              {intl.formatMessage({ id: 'receipts.actions.applyAdjustment' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
