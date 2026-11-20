import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import type { Custodian } from '@/project/custodians/model/custodian';
import { MATERIAL_MODEL_IMAGES_BUCKET } from '@/project/material-models/api/material-models.api';
import { useMaterialModelsQuery } from '@/project/material-models/hooks/use-material-models';
import {
  DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
  mapPublicSpecificationSettings,
} from '@/project/material-models/model/material-model';
import { MaterialSpreadsheetImportDialog } from '@/project/materials/components/material-spreadsheet-dialog';
import type { MaterialSpreadsheetImportDraftRow } from '@/project/materials/spreadsheet/material-spreadsheet-import';
import { useWarehousesQuery } from '@/project/warehouses/hooks/use-warehouses';
import { ClipboardPlus, Save, Upload } from 'lucide-react';
import { useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';
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
import type { SelectOption } from '@/components/ui/option-select';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { MaterialReceiptLineMaterialDrawer } from '../components/material-receipt-line-material-drawer';
import { MaterialReceiptRecipientDialog } from '../components/material-receipt-recipient-dialog';
import {
  mapMaterialReceiptToFormValues,
  MaterialReceiptHeaderForm,
  useMaterialReceiptForm,
} from '../forms/material-receipt-form.generated';
import {
  useApplyMaterialReceiptAdjustmentMutation,
  useImportMaterialReceiptFromExcelMutation,
  useMaterialReceiptAdjustmentPreviewMutation,
  useMaterialReceiptQuery,
  useMaterialReceiptRecipientOptionsQuery,
  useSaveMaterialReceiptMutation,
} from '../hooks/use-material-receipts';
import type {
  MaterialReceiptAdjustmentPreview,
  MaterialReceiptFormValues,
  MaterialReceiptLineInput,
  MaterialReceiptRepresentativeInput,
} from '../model/material-receipt';
import {
  createMaterialReceiptLine,
  MATERIAL_RECEIPT_PERMISSION_CODES,
  toMaterialReceiptLineInputs,
} from '../model/material-receipt';
import { MaterialReceiptLinesEditorTable } from '../table/material-receipt-lines-editor-table.generated';

function getExcelImportErrorMessage(error: unknown, intl: IntlShape) {
  const message = getApiErrorMessage(error);
  const line = message.match(/Line\s+(\d+)/i)?.[1];
  if (/invalid or inactive receiving unit/i.test(message) && line) {
    return intl.formatMessage(
      { id: 'receipts.errors.excelInvalidRecipient' },
      { line },
    );
  }
  if (/is inactive and cannot be allocated/i.test(message) && line) {
    return intl.formatMessage(
      { id: 'receipts.errors.excelInactiveAllocation' },
      { line },
    );
  }
  const duplicate = message.match(
    /Line\s+(\d+)\s+(?:repeats internal code |internal code )(.+?)(?: in this file| already exists in the materials catalog)/i,
  );
  if (duplicate) {
    return intl.formatMessage(
      { id: 'receipts.errors.excelDuplicateCode' },
      { line: duplicate[1], code: duplicate[2] },
    );
  }
  if (/duplicate key value/i.test(message)) {
    return intl.formatMessage({
      id: 'receipts.errors.excelDuplicateCodeUnknown',
    });
  }
  if (/request ID was already used with different content/i.test(message)) {
    return intl.formatMessage({ id: 'receipts.errors.excelRequestChanged' });
  }
  return message;
}

export function MaterialReceiptEditorPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isAdjustment = searchParams.get('adjust') === '1';
  const { userId, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canManage = hasPermission(MATERIAL_RECEIPT_PERMISSION_CODES.manage);
  const form = useMaterialReceiptForm();
  const query = useMaterialReceiptQuery(
    id,
    Boolean(id) && (isPermissionsPending || canManage),
  );
  const warehousesQuery = useWarehousesQuery(
    false,
    isPermissionsPending || canManage,
  );
  const selectedWarehouseId = form.watch('warehouseId');
  const recipientOptionsQuery = useMaterialReceiptRecipientOptionsQuery(
    selectedWarehouseId || null,
    !isPermissionsPending && canManage,
  );
  const modelsQuery = useMaterialModelsQuery(isPermissionsPending || canManage);
  const saveMutation = useSaveMaterialReceiptMutation();
  const excelImportMutation = useImportMaterialReceiptFromExcelMutation();
  const previewMutation = useMaterialReceiptAdjustmentPreviewMutation();
  const applyMutation = useApplyMaterialReceiptAdjustmentMutation();
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [preview, setPreview] =
    useState<MaterialReceiptAdjustmentPreview | null>(null);
  const [previewLines, setPreviewLines] = useState<MaterialReceiptLineInput[]>(
    [],
  );
  const [activeMaterialLine, setActiveMaterialLine] = useState<number | null>(
    null,
  );
  const [isMaterialImportOpen, setIsMaterialImportOpen] = useState(false);
  const [activeReceivingLineClientId, setActiveReceivingLineClientId] =
    useState<string | null>(null);
  const [excelImportLines, setExcelImportLines] = useState<
    Record<
      string,
      {
        code: string;
        linkedCodes: Array<{ label: string; value: string }>;
      }
    >
  >({});
  const [representatives, setRepresentatives] = useState<
    Record<string, MaterialReceiptRepresentativeInput>
  >({});
  const [confirmedHandoverIds, setConfirmedHandoverIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const loadedId = useRef('');
  const receipt = query.data;
  const warehouses = warehousesQuery.data ?? [];
  const custodians = useMemo<Custodian[]>(
    () =>
      (recipientOptionsQuery.data ?? []).map((party) => ({
        ...party,
        sourceType: null,
        sourceId: null,
        canRepresent: false,
        canManageMaterial: false,
        canManageHandover: false,
        accountUserId: null,
        accountUserIds: [],
        representativeUserId: null,
        representativeDisplayName: null,
        isActive: true,
        createdAt: '',
        updatedAt: '',
      })),
    [recipientOptionsQuery.data],
  );
  const eligibleReceivingParties = useMemo(
    () => custodians.filter((party) => party.isActive),
    [custodians],
  );
  const receivingPartyOptions = useMemo<SelectOption<Custodian>[]>(
    () =>
      eligibleReceivingParties.map((party) => ({
        value: party.id,
        label: party.name,
        searchableText: `${party.name} ${party.code}`,
        data: party,
      })),
    [eligibleReceivingParties],
  );
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
  const materialNameByClientId = useMemo(
    () =>
      new Map(
        Object.entries(representatives).map(([clientId, representative]) => [
          clientId,
          representative.materialValues.nameOverride.trim(),
        ]),
      ),
    [representatives],
  );
  const saveBusy =
    saveMutation.isPending ||
    excelImportMutation.isPending ||
    previewMutation.isPending ||
    applyMutation.isPending;
  const hasExcelImportDraftLines = form
    .watch('lines')
    .some((line) => Boolean(excelImportLines[line.clientId]));
  const watchedLines = form.watch('lines');
  const activeReceivingLine = watchedLines.find(
    (line) => line.clientId === activeReceivingLineClientId,
  );
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
  const handleImportToReceipt = useCallback(
    (rows: MaterialSpreadsheetImportDraftRow[]) => {
      const importedLines = rows.map(({ values, quantity }) => {
        const line = {
          ...createMaterialReceiptLine(),
          modelId: values.modelId,
          quantity,
          receivingPartyId:
            values.ownerPartyId === form.getValues('warehouseId')
              ? null
              : values.ownerPartyId || null,
          condition: values.condition,
          note: values.note,
          specificationOverrides: values.specificationOverrides,
          specificationOverrideLabels: values.specificationOverrideLabels ?? {},
          items: Array.from({ length: quantity }, () => ({
            serialNumber: quantity === 1 ? values.serialNumber : '',
            condition: values.condition,
            conditionNote: '',
            note: quantity === 1 ? values.note : '',
          })),
        };
        const model = modelsQuery.data?.find(({ id }) => id === values.modelId);
        return {
          line,
          representative: {
            materialValues: { ...values },
            images: (model?.images ?? []).map((image) => ({
              ...image,
              storageBucket: MATERIAL_MODEL_IMAGES_BUCKET,
            })),
            publicDisplaySettings:
              model?.publicDisplaySettings ??
              DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
            publicSpecificationSettings: mapPublicSpecificationSettings(
              model?.specifications ?? [],
            ),
          } satisfies MaterialReceiptRepresentativeInput,
        };
      });
      setRepresentatives((current) => ({
        ...current,
        ...Object.fromEntries(
          importedLines.map(({ line, representative }) => [
            line.clientId,
            representative,
          ]),
        ),
      }));
      setExcelImportLines((current) => ({
        ...current,
        ...Object.fromEntries(
          importedLines.map(({ line }, index) => {
            const values = rows[index].values;
            return [
              line.clientId,
              {
                code: values.code.trim(),
                linkedCodes: values.linkedCodes,
              },
            ];
          }),
        ),
      }));
      form.setValue(
        'lines',
        [...form.getValues('lines'), ...importedLines.map(({ line }) => line)],
        { shouldDirty: true, shouldValidate: true },
      );
    },
    [form, modelsQuery.data],
  );

  useEffect(() => {
    if (!receipt || loadedId.current === receipt.id) return;
    form.reset(mapMaterialReceiptToFormValues(receipt));
    setRepresentatives(
      Object.fromEntries(
        receipt.lines.flatMap((line) =>
          line.representative
            ? [
                [
                  line.id,
                  {
                    materialValues: line.representative.materialValues,
                    images: line.representative.images,
                    publicDisplaySettings:
                      line.representative.publicDisplaySettings,
                    publicSpecificationSettings:
                      line.representative.publicSpecificationSettings,
                  },
                ],
              ]
            : [],
        ),
      ),
    );
    loadedId.current = receipt.id;
  }, [form, receipt]);

  const onSubmit = (values: MaterialReceiptFormValues) => {
    if (!canManage) return;
    const selectedWarehouse = warehouses.find(
      (warehouse) => warehouse.id === values.warehouseId,
    );
    const representativesForReceipt = Object.fromEntries(
      Object.entries(representatives).map(([clientId, representative]) => [
        clientId,
        selectedWarehouse
          ? {
              ...representative,
              materialValues: {
                ...representative.materialValues,
                ownerPartyId: selectedWarehouse.id,
                ownerSnapshot: {
                  kind: 'warehouse' as const,
                  code: selectedWarehouse.code,
                  name: selectedWarehouse.name,
                  representativeName: '',
                  phone: '',
                  email: '',
                },
              },
            }
          : representative,
      ]),
    );
    const lines = toMaterialReceiptLineInputs(
      values,
      isAdjustment,
      false,
      representativesForReceipt,
    );
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
    const excelLines = lines.map((line, index) => {
      const importData = excelImportLines[values.lines[index]?.clientId ?? ''];
      return {
        ...line,
        receivingPartyId:
          line.receivingPartyId === values.warehouseId
            ? null
            : line.receivingPartyId,
        items: line.items.map((item, itemIndex) => ({
          ...item,
          ...(itemIndex === 0 && importData?.code
            ? { code: importData.code }
            : {}),
          linkedCodes: itemIndex === 0 ? (importData?.linkedCodes ?? []) : [],
        })),
      };
    });
    const hasExcelImportLines = values.lines.some((line) =>
      Boolean(excelImportLines[line.clientId]),
    );
    const eligibleReceiverIds = new Set(
      eligibleReceivingParties.map((party) => party.id),
    );
    const invalidReceiverIndex = values.lines.findIndex((line) => {
      const receivingPartyId =
        line.receivingPartyId === values.warehouseId
          ? null
          : line.receivingPartyId;
      return Boolean(
        receivingPartyId && !eligibleReceiverIds.has(receivingPartyId),
      );
    });
    if (
      !recipientOptionsQuery.isPending &&
      !recipientOptionsQuery.isError &&
      invalidReceiverIndex >= 0
    ) {
      toast.error(
        intl.formatMessage(
          { id: 'receipts.errors.invalidReceivingParty' },
          { line: invalidReceiverIndex + 1 },
        ),
      );
      return;
    }
    if (hasExcelImportLines) {
      excelImportMutation.mutate(
        {
          actorUserId: userId ?? '',
          values: {
            warehouseId: values.warehouseId,
            note: values.note,
            lines: excelLines,
          },
        },
        {
          onSuccess: (savedId) => {
            toast.success(
              intl.formatMessage({ id: 'receipts.toasts.importedFromExcel' }),
            );
            navigate(ROUTES.PROJECT.RECEIPT_DETAIL.replace(':id', savedId));
          },
          onError: (error) =>
            toast.error(getExcelImportErrorMessage(error, intl)),
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
          lines: toMaterialReceiptLineInputs(
            values,
            false,
            false,
            representativesForReceipt,
          ),
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
                  : hasExcelImportDraftLines
                    ? 'receipts.actions.recordExcelReceipt'
                    : 'receipts.actions.saveDraft',
              })}
              disabled={isAdjustment && !adjustmentReason.trim()}
            >
              <Save className="size-4" />
              {intl.formatMessage({
                id: isAdjustment
                  ? 'receipts.actions.previewAdjustment'
                  : hasExcelImportDraftLines
                    ? 'receipts.actions.recordExcelReceipt'
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
      hasExcelImportDraftLines,
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
          materialNameByClientId={materialNameByClientId}
          receivingParties={custodians}
          receivingPartySelectionDisabled={
            isAdjustment || !canManage || !selectedWarehouseId || saveBusy
          }
          toolbarContent={
            !id && !isAdjustment ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setIsMaterialImportOpen(true)}
                >
                  <Upload className="size-4" />
                  {intl.formatMessage({ id: 'receipts.actions.importExcel' })}
                </Button>
              </div>
            ) : null
          }
          onEditMaterial={setActiveMaterialLine}
          onEditReceivingParty={setActiveReceivingLineClientId}
          onCopySelected={(rows) => {
            const entries = rows.map((line) => {
              const copy = {
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
              };
              return { source: line, copy };
            });
            const copies = entries.map(({ copy }) => copy);
            setRepresentatives((current) => {
              const next = { ...current };
              for (const { source, copy } of entries) {
                const representative = current[source.clientId];
                if (representative) next[copy.clientId] = representative;
              }
              return next;
            });
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
        model={selectedDrawerModel}
        modelLoading={modelsQuery.isPending}
        modelError={modelsQuery.error}
        onRetryModel={() => void modelsQuery.refetch()}
        quantity={selectedDrawerFormLine?.quantity ?? 0}
        warehouseId={form.watch('warehouseId')}
        representative={
          selectedDrawerFormLine &&
          representatives[selectedDrawerFormLine.clientId]?.materialValues
            .modelId === selectedDrawerFormLine.modelId
            ? {
                id: selectedDrawerFormLine.lineId,
                ...representatives[selectedDrawerFormLine.clientId],
              }
            : null
        }
        readOnly={isAdjustment}
        isSaving={saveBusy}
        onSave={(representative) => {
          if (activeMaterialLine === null) return;
          const line = form.getValues(`lines.${activeMaterialLine}`);
          if (!line) return;
          setRepresentatives((current) => ({
            ...current,
            [line.clientId]: representative,
          }));
          setExcelImportLines((current) =>
            current[line.clientId]
              ? {
                  ...current,
                  [line.clientId]: {
                    ...current[line.clientId],
                    code: representative.materialValues.code.trim(),
                    linkedCodes: representative.materialValues.linkedCodes,
                  },
                }
              : current,
          );
          form.setValue(
            `lines.${activeMaterialLine}.specificationOverrides`,
            representative.materialValues.specificationOverrides,
            { shouldDirty: true, shouldValidate: true },
          );
          form.setValue(
            `lines.${activeMaterialLine}.specificationOverrideLabels`,
            representative.materialValues.specificationOverrideLabels ?? {},
            { shouldDirty: true, shouldValidate: true },
          );
          setActiveMaterialLine(null);
        }}
      />
      <MaterialSpreadsheetImportDialog
        open={isMaterialImportOpen}
        onOpenChange={setIsMaterialImportOpen}
        onImportToDraft={handleImportToReceipt}
        receiptRecipientOptions={custodians}
        receiptRecipientOptionsLoading={recipientOptionsQuery.isFetching}
        receiptRecipientOptionsError={recipientOptionsQuery.isError}
        onRetryReceiptRecipientOptions={() =>
          void recipientOptionsQuery.refetch()
        }
      />
      <MaterialReceiptRecipientDialog
        open={Boolean(activeReceivingLine)}
        onOpenChange={(open) => !open && setActiveReceivingLineClientId(null)}
        value={activeReceivingLine?.receivingPartyId ?? ''}
        options={receivingPartyOptions}
        loading={recipientOptionsQuery.isFetching}
        error={
          recipientOptionsQuery.isError
            ? getApiErrorMessage(recipientOptionsQuery.error)
            : undefined
        }
        onRetry={() => void recipientOptionsQuery.refetch()}
        disabled={saveBusy}
        onChange={(receivingPartyId) => {
          if (!activeReceivingLineClientId) return;
          const lineIndex = watchedLines.findIndex(
            (line) => line.clientId === activeReceivingLineClientId,
          );
          if (lineIndex < 0) return;
          form.setValue(
            `lines.${lineIndex}.receivingPartyId`,
            receivingPartyId || null,
            { shouldDirty: true, shouldValidate: true },
          );
          setActiveReceivingLineClientId(null);
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
