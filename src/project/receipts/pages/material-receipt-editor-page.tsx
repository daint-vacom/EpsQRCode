import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import type { Custodian } from '@/project/custodians/model/custodian';
import { useHandoversQuery } from '@/project/handover/hooks/use-handovers';
import {
  HANDOVER_DOCUMENT_COLUMN_PINNING,
  useHandoverDocumentColumns,
} from '@/project/handover/table/handover.columns.generated';
import { MATERIAL_MODEL_IMAGES_BUCKET } from '@/project/material-models/api/material-models.api';
import { useMaterialModelsQuery } from '@/project/material-models/hooks/use-material-models';
import {
  DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
  mapPublicSpecificationSettings,
} from '@/project/material-models/model/material-model';
import { MaterialSpreadsheetImportDialog } from '@/project/materials/components/material-spreadsheet-dialog';
import type { MaterialSpreadsheetImportDraftRow } from '@/project/materials/spreadsheet/material-spreadsheet-import';
import { useWarehousesQuery } from '@/project/warehouses/hooks/use-warehouses';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { PaginationState } from '@tanstack/react-table';
import { ClipboardPlus, LoaderCircle, Save, Upload } from 'lucide-react';
import { useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import type { SelectOption } from '@/components/ui/option-select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper';
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
  useApplyMaterialReceiptInlineUpdateMutation,
  useImportMaterialReceiptFromExcelMutation,
  useMaterialReceiptAdjustmentPreviewMutation,
  useMaterialReceiptInlineUpdatePreviewMutation,
  useMaterialReceiptQuery,
  useMaterialReceiptRecipientOptionsQuery,
  useSaveMaterialReceiptMutation,
} from '../hooks/use-material-receipts';
import type {
  MaterialReceiptAdjustmentPreview,
  MaterialReceiptFormValues,
  MaterialReceiptInlineUpdatePreview,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdjustment = searchParams.get('adjust') === '1';
  const { userId, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_RECEIPT_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_RECEIPT_PERMISSION_CODES.manage);
  const canRead = canView || canManage;
  const form = useMaterialReceiptForm();
  const hasUnsavedChanges = form.formState.isDirty;
  const query = useMaterialReceiptQuery(
    id,
    Boolean(id) && (isPermissionsPending || canRead),
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
  const custodianDirectoryQuery = useCustodiansQuery(
    true,
    isPermissionsPending || canRead,
  );
  const modelsQuery = useMaterialModelsQuery(isPermissionsPending || canRead);
  const saveMutation = useSaveMaterialReceiptMutation();
  const excelImportMutation = useImportMaterialReceiptFromExcelMutation();
  const previewMutation = useMaterialReceiptAdjustmentPreviewMutation();
  const applyMutation = useApplyMaterialReceiptAdjustmentMutation();
  const inlinePreviewMutation = useMaterialReceiptInlineUpdatePreviewMutation();
  const inlineApplyMutation = useApplyMaterialReceiptInlineUpdateMutation();
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [activeStep, setActiveStep] = useState(
    searchParams.get('step') === '2' ? 2 : 1,
  );
  const [confirmStepOpen, setConfirmStepOpen] = useState(false);
  const [handoverPagination, setHandoverPagination] = useState<PaginationState>(
    { pageIndex: 0, pageSize: 20 },
  );
  const [preview, setPreview] = useState<
    MaterialReceiptAdjustmentPreview | MaterialReceiptInlineUpdatePreview | null
  >(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
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
  const readOnly = Boolean(
    !canManage ||
    (receipt &&
      !isAdjustment &&
      receipt.status !== 'draft' &&
      receipt.status !== 'handover'),
  );
  const handoversQuery = useHandoversQuery(
    {
      receiptId: id || undefined,
      page: handoverPagination.pageIndex + 1,
      pageSize: handoverPagination.pageSize,
    },
    Boolean(id) && activeStep === 2 && canRead,
  );
  const handovers = handoversQuery.data?.items ?? [];
  const noOpViewHandover = useCallback(() => {}, []);
  const handoverColumns = useHandoverDocumentColumns({
    onView: noOpViewHandover,
  });
  const handoversTable = useReactTable({
    data: handovers,
    columns: handoverColumns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(
      (handoversQuery.data?.total ?? 0) / handoverPagination.pageSize,
    ),
    state: {
      columnPinning: HANDOVER_DOCUMENT_COLUMN_PINNING,
      columnVisibility: { actions: false },
      pagination: handoverPagination,
    },
    onPaginationChange: setHandoverPagination,
  });
  const warehouses = warehousesQuery.data ?? [];
  const custodians = useMemo<Custodian[]>(
    () =>
      recipientOptionsQuery.data
        ? recipientOptionsQuery.data.map((party) => ({
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
          }))
        : (custodianDirectoryQuery.data ?? []),
    [custodianDirectoryQuery.data, recipientOptionsQuery.data],
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
    applyMutation.isPending ||
    inlinePreviewMutation.isPending ||
    inlineApplyMutation.isPending;
  const previewPending =
    previewMutation.isPending || inlinePreviewMutation.isPending;
  const previewDialogProcessing =
    previewPending || (inlineApplyMutation.isPending && preview === null);
  const watchedLines = form.watch('lines');
  const totalMaterialCount = watchedLines.reduce(
    (total, line) => total + Math.max(0, Number(line.quantity) || 0),
    0,
  );
  const allocationPercent = receipt?.totalItems
    ? Math.min(
        100,
        Math.floor(
          ((receipt.receivedItems + receipt.pendingAllocationItems) /
            receipt.totalItems) *
            100,
        ),
      )
    : 0;
  const allocationBadgeVariant =
    allocationPercent === 0
      ? 'destructive'
      : allocationPercent === 100
        ? 'success'
        : 'warning';
  const activeReceivingLine = watchedLines.find(
    (line) => line.clientId === activeReceivingLineClientId,
  );
  const pageReady =
    !isPermissionsPending && (!id || (!query.isPending && Boolean(receipt)));
  const navigateBack = useCallback(
    () => navigate(ROUTES.PROJECT.RECEIPTS),
    [navigate],
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

  useEffect(() => {
    if (
      !receipt ||
      isAdjustment ||
      searchParams.has('step') ||
      receipt.status !== 'handover'
    ) {
      return;
    }
    setActiveStep(2);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('step', '2');
        return next;
      },
      { replace: true },
    );
  }, [isAdjustment, receipt, searchParams, setSearchParams]);

  const applyInlineUpdate = (
    result: MaterialReceiptInlineUpdatePreview,
    lines: MaterialReceiptLineInput[],
  ) => {
    if (!receipt) return;
    inlineApplyMutation.mutate(
      {
        id: receipt.id,
        expectedVersion: receipt.version,
        previewToken: result.previewToken,
        warehouseId: result.warehouseId,
        note: form.getValues('note'),
        lines,
        cancelHandoverIds: result.affectedHandovers.map(
          (handover) => handover.id,
        ),
      },
      {
        onSuccess: async () => {
          const refreshedReceipt = await query.refetch();
          if (
            refreshedReceipt.data &&
            refreshedReceipt.data.version > receipt.version
          ) {
            form.reset(mapMaterialReceiptToFormValues(refreshedReceipt.data));
            setRepresentatives(
              Object.fromEntries(
                refreshedReceipt.data.lines.flatMap((line) =>
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
          } else if (refreshedReceipt.isError) {
            toast.error(getApiErrorMessage(refreshedReceipt.error));
          }
          toast.success(
            intl.formatMessage({ id: 'receipts.toasts.inlineUpdated' }),
          );
          setPreview(null);
          setPreviewDialogOpen(false);
          setConfirmStepOpen(false);
          setActiveStep(2);
          setSearchParams(
            (current) => {
              const next = new URLSearchParams(current);
              next.set('step', '2');
              return next;
            },
            { replace: true },
          );
        },
        onError: (error) => {
          setPreview(result);
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  };

  const onSubmit = (
    values: MaterialReceiptFormValues,
    afterStepConfirmation = false,
  ) => {
    if (!canManage) return;
    if (!isAdjustment && receipt?.status === 'handover' && !hasUnsavedChanges) {
      setConfirmStepOpen(false);
      setActiveStep(2);
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set('step', '2');
          return next;
        },
        { replace: true },
      );
      return;
    }
    if (
      !isAdjustment &&
      !afterStepConfirmation &&
      receipt?.status !== 'handover'
    ) {
      setConfirmStepOpen(true);
      return;
    }
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
      isAdjustment || receipt?.status === 'handover',
      receipt?.status === 'handover',
      representativesForReceipt,
    );
    if (!isAdjustment && receipt?.status === 'handover') {
      setPreview(null);
      setPreviewDialogOpen(true);
      inlinePreviewMutation.mutate(
        {
          id: receipt.id,
          expectedVersion: receipt.version,
          warehouseId: values.warehouseId,
          lines,
        },
        {
          onSuccess: (result) => {
            setPreviewLines(lines);
            setConfirmedHandoverIds(new Set());
            if (
              result.affectedHandovers.length === 0 &&
              result.blockedItems.length === 0
            ) {
              applyInlineUpdate(result, lines);
            } else {
              setPreview(result);
            }
          },
          onError: (error) => {
            setPreviewDialogOpen(false);
            toast.error(getApiErrorMessage(error));
          },
        },
      );
      return;
    }
    if (isAdjustment) {
      if (!adjustmentReason.trim()) {
        toast.error(
          intl.formatMessage({ id: 'receipts.errors.adjustmentReason' }),
        );
        return;
      }
      if (!receipt) return;
      setPreview(null);
      setPreviewDialogOpen(true);
      previewMutation.mutate(
        { id: receipt.id, expectedVersion: receipt.version, lines },
        {
          onSuccess: (result) => {
            setPreview(result);
            setPreviewLines(lines);
            setConfirmedHandoverIds(new Set());
          },
          onError: (error) => {
            setPreviewDialogOpen(false);
            toast.error(getApiErrorMessage(error));
          },
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
            setActiveStep(2);
            navigate(
              `${ROUTES.PROJECT.RECEIPT_DETAIL.replace(':id', savedId)}?step=2`,
              { replace: true },
            );
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
          setConfirmStepOpen(false);
          setActiveStep(2);
          if (id) {
            setSearchParams(
              (current) => {
                const next = new URLSearchParams(current);
                next.set('step', '2');
                return next;
              },
              { replace: true },
            );
          } else {
            navigate(
              `${ROUTES.PROJECT.RECEIPT_DETAIL.replace(':id', savedId)}?step=2`,
              { replace: true },
            );
          }
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
      actions:
        isAdjustment || activeStep === 1 ? (
          <div className="flex flex-wrap gap-2">
            {!readOnly ? (
              <Button
                type="submit"
                form="materialReceipt-form"
                variant="primary"
                size="md"
                loading={
                  saveMutation.isPending || excelImportMutation.isPending
                }
                loadingText={intl.formatMessage({
                  id: isAdjustment
                    ? 'receipts.actions.previewAdjustment'
                    : 'receipts.handover.steps.saveAndContinue',
                })}
                disabled={isAdjustment && !adjustmentReason.trim()}
              >
                <Save className="size-4" />
                {intl.formatMessage({
                  id: isAdjustment
                    ? 'receipts.actions.previewAdjustment'
                    : 'receipts.handover.steps.saveAndContinue',
                })}
              </Button>
            ) : null}
          </div>
        ) : null,
    }),
    [
      adjustmentReason,
      readOnly,
      intl,
      isAdjustment,
      navigateBack,
      receipt?.code,
      saveMutation.isPending,
      excelImportMutation.isPending,
      activeStep,
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
  if (!canRead) {
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

  const receiptDetailsCard = (
    <Card className="shrink-0">
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
          readOnly={readOnly}
          warehouseName={receipt?.warehouse.name}
        />
      </CardContent>
    </Card>
  );

  const editorContent = (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
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
      <Card className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <MaterialReceiptLinesEditorTable
          form={form}
          createLine={createLine}
          modelById={modelById}
          materialNameByClientId={materialNameByClientId}
          receivingParties={custodians}
          receivingPartySelectionDisabled={
            isAdjustment || readOnly || !selectedWarehouseId || saveBusy
          }
          readOnly={readOnly}
          toolbarContent={
            !id && !isAdjustment && !readOnly ? (
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
        readOnly={isAdjustment || readOnly}
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
        open={previewDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setPreviewDialogOpen(true);
          } else if (!saveBusy) {
            setPreview(null);
            setPreviewDialogOpen(false);
          }
        }}
      >
        <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 pe-14 text-start">
            <DialogTitle>
              {intl.formatMessage({
                id:
                  receipt?.status === 'handover' && !isAdjustment
                    ? 'receipts.dialogs.inlineUpdateTitle'
                    : 'receipts.dialogs.adjustmentTitle',
              })}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="min-h-0 overflow-y-auto px-6 pb-5">
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
                {'warehouseChanged' in preview && preview.warehouseChanged ? (
                  <p className="text-sm text-muted-foreground">
                    {intl.formatMessage({
                      id: 'receipts.inlineUpdate.warehouseChanged',
                    })}
                  </p>
                ) : null}
                <section>
                  <h3 className="text-sm font-semibold">
                    {intl.formatMessage({
                      id: 'receipts.adjustment.affectedHandovers',
                    })}
                  </h3>
                  {preview.affectedHandovers.length > 0 &&
                  receipt?.status === 'handover' &&
                  !isAdjustment ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {intl.formatMessage({
                        id: 'receipts.inlineUpdate.pendingWarning',
                      })}
                    </p>
                  ) : null}
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
                {preview.blockedItems.length ? (
                  <p className="text-sm text-destructive">
                    {intl.formatMessage({
                      id: 'receipts.inlineUpdate.blockedDescription',
                    })}
                  </p>
                ) : null}
              </div>
            ) : previewDialogProcessing ? (
              <div
                className="flex min-h-28 items-center justify-center gap-3 text-sm text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <LoaderCircle className="size-5 animate-spin" />
                {intl.formatMessage({
                  id:
                    previewPending || applyMutation.isPending
                      ? 'receipts.inlineUpdate.checking'
                      : 'receipts.inlineUpdate.saving',
                })}
              </div>
            ) : null}
          </DialogBody>
          {!previewDialogProcessing ? (
            <DialogFooter className="shrink-0 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={saveBusy}
                onClick={() => {
                  setPreview(null);
                  setPreviewDialogOpen(false);
                }}
              >
                {intl.formatMessage({ id: 'common.actions.cancel' })}
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={
                  applyMutation.isPending || inlineApplyMutation.isPending
                }
                loadingText={intl.formatMessage({
                  id:
                    receipt?.status === 'handover' && !isAdjustment
                      ? 'receipts.inlineUpdate.apply'
                      : 'receipts.actions.applyAdjustment',
                })}
                disabled={
                  !preview ||
                  saveBusy ||
                  preview.blockedItems.length > 0 ||
                  confirmedHandoverIds.size !== preview.affectedHandovers.length
                }
                onClick={() => {
                  if (!receipt || !preview) return;
                  if (receipt.status === 'handover' && !isAdjustment) {
                    if (!('warehouseId' in preview)) return;
                    applyInlineUpdate(preview, previewLines);
                    return;
                  }
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
                          intl.formatMessage({
                            id: 'receipts.toasts.adjusted',
                          }),
                        );
                        navigate(
                          ROUTES.PROJECT.RECEIPT_DETAIL.replace(
                            ':id',
                            receipt.id,
                          ),
                        );
                      },
                      onError: (error) =>
                        toast.error(getApiErrorMessage(error)),
                    },
                  );
                }}
              >
                {intl.formatMessage({
                  id:
                    receipt?.status === 'handover' && !isAdjustment
                      ? 'receipts.inlineUpdate.apply'
                      : 'receipts.actions.applyAdjustment',
                })}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );

  const confirmSaveAndContinue = () => {
    void form.handleSubmit((values) => onSubmit(values, true))();
  };

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 lg:p-5">
      {receiptDetailsCard}
      {isAdjustment ? (
        editorContent
      ) : (
        <Stepper
          value={activeStep}
          variant="success"
          onValueChange={(step) => {
            if (step === 1) {
              setActiveStep(1);
              setSearchParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  next.set('step', '1');
                  return next;
                },
                { replace: true },
              );
            } else if (step === 2 && activeStep !== 2) {
              if (readOnly) {
                setActiveStep(2);
                setSearchParams(
                  (current) => {
                    const next = new URLSearchParams(current);
                    next.set('step', '2');
                    return next;
                  },
                  { replace: true },
                );
              } else {
                if (receipt?.status === 'handover') {
                  confirmSaveAndContinue();
                } else {
                  setConfirmStepOpen(true);
                }
              }
            }
          }}
          className="flex h-[calc(100dvh-5rem)] flex-none flex-col gap-4"
        >
          <StepperNav className="shrink-0 justify-center py-4">
            <StepperItem step={1} fill={false}>
              <StepperTrigger>
                <StepperIndicator className="data-[state=inactive]:bg-border data-[state=active]:ring-2 data-[state=active]:ring-primary data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background">
                  1
                </StepperIndicator>
                <StepperTitle>
                  {intl.formatMessage({
                    id: 'receipts.handover.steps.items',
                  })}
                </StepperTitle>
                <Badge variant="primary" size="md">
                  {intl.formatMessage(
                    { id: 'receipts.handover.steps.materialCount' },
                    { count: totalMaterialCount },
                  )}
                </Badge>
              </StepperTrigger>
              <StepperSeparator
                className={`mx-4 my-0 h-0 w-12 flex-none border-t border-dashed ${activeStep === 2 ? 'border-[var(--color-success-accent,var(--color-green-600))]' : 'border-border'} bg-transparent`}
              />
            </StepperItem>
            <StepperItem step={2} fill={false}>
              <StepperTrigger>
                <StepperIndicator className="data-[state=inactive]:bg-border data-[state=active]:ring-2 data-[state=active]:ring-primary data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background">
                  2
                </StepperIndicator>
                <StepperTitle>
                  {intl.formatMessage({
                    id: 'receipts.handover.steps.allocation',
                  })}
                </StepperTitle>
                <Badge variant={allocationBadgeVariant} size="md">
                  {intl.formatMessage(
                    { id: 'receipts.handover.steps.allocationProgress' },
                    { percent: allocationPercent },
                  )}
                </Badge>
              </StepperTrigger>
            </StepperItem>
          </StepperNav>
          <StepperContent value={1} className="flex min-h-0 flex-1 flex-col">
            {editorContent}
          </StepperContent>
          <StepperContent value={2} className="flex min-h-0 flex-1 flex-col">
            <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
              <CardHeader>
                <CardTitle>
                  {intl.formatMessage({ id: 'receipts.tabs.handovers' })}
                </CardTitle>
              </CardHeader>
              <DataGrid
                table={handoversTable}
                recordCount={handoversQuery.data?.total ?? 0}
                isLoading={handoversQuery.isPending}
                isFetching={handoversQuery.isFetching}
                emptyMessage={intl.formatMessage({
                  id: 'receipts.empty.handovers',
                })}
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
          </StepperContent>
        </Stepper>
      )}
      <ConfirmDialog
        open={confirmStepOpen}
        onOpenChange={setConfirmStepOpen}
        title={intl.formatMessage({
          id: 'receipts.handover.steps.confirmTitle',
        })}
        description={intl.formatMessage({
          id: 'receipts.handover.steps.confirmDescription',
        })}
        confirmLabel={intl.formatMessage({
          id: 'receipts.handover.steps.confirmSave',
        })}
        cancelLabel={intl.formatMessage({ id: 'common.actions.cancel' })}
        isConfirming={saveBusy}
        closeOnConfirm={false}
        onConfirm={confirmSaveAndContinue}
      />
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
