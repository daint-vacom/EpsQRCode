import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { EpsUnitSelectionDialog } from '@/project/custodians/components/eps-unit-selection-dialog';
import type { EpsUnitSelectionItem } from '@/project/custodians/components/eps-unit-selection-dialog';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import type { Custodian } from '@/project/custodians/model/custodian';
import { loadHandovers } from '@/project/handover/api/handovers.api';
import {
  handoverKeys,
  useHandoversQuery,
} from '@/project/handover/hooks/use-handovers';
import type { HandoverDocument } from '@/project/handover/model/handover';
import { HANDOVER_PERMISSION_CODES } from '@/project/handover/model/handover-permissions';
import { useHandoverDocumentColumns } from '@/project/handover/table/handover.columns.generated';
import { MaterialGroupFilterSidebar } from '@/project/material-groups/components/material-group-filter-tree';
import { useMaterialGroupsQuery } from '@/project/material-groups/hooks/use-material-groups';
import { getMaterialGroupDescendantIds } from '@/project/material-groups/model/material-group-tree';
import { MATERIAL_MODEL_IMAGES_BUCKET } from '@/project/material-models/api/material-models.api';
import { useMaterialModelsQuery } from '@/project/material-models/hooks/use-material-models';
import {
  DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
  mapPublicSpecificationSettings,
} from '@/project/material-models/model/material-model';
import { MaterialSpreadsheetImportDialog } from '@/project/materials/components/material-spreadsheet-dialog';
import type { MaterialSpreadsheetImportDraftRow } from '@/project/materials/spreadsheet/material-spreadsheet-import';
import { useWarehousesQuery } from '@/project/warehouses/hooks/use-warehouses';
import { useQueries } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CircleEllipsis,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PROJECT_FEATURE_ICONS } from '@/config/project-feature-icons';
import { getApiErrorMessage } from '@/lib/errors';
import { toAbsoluteUrl } from '@/lib/helpers';
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
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/loading';
import type { SelectOption } from '@/components/ui/option-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { MaterialReceiptAllocationChart } from '../charts/receipt-allocation.chart.generated';
import { MaterialReceiptLineMaterialDrawer } from '../components/material-receipt-line-material-drawer';
import { MaterialReceiptRecipientDialog } from '../components/material-receipt-recipient-dialog';
import {
  mapMaterialReceiptToFormValues,
  MaterialReceiptHeaderForm,
  useMaterialReceiptForm,
} from '../forms/material-receipt-form.generated';
import {
  useApplyMaterialReceiptInlineUpdateMutation,
  useDeleteMaterialReceiptMutation,
  useImportMaterialReceiptFromExcelMutation,
  useMaterialReceiptActionMutation,
  useMaterialReceiptInlineUpdatePreviewMutation,
  useMaterialReceiptQuery,
  useSaveMaterialReceiptMutation,
} from '../hooks/use-material-receipts';
import type {
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

const EMPTY_CUSTODIANS: Custodian[] = [];
const HANDOVER_GROUP_PAGE_SIZE = 100;

interface ReceiptHandoverGroup {
  id: string;
  code: string;
  name: string;
  allocatedQuantity: number;
  handovers: HandoverDocument[];
}

type ReceiptHandoverGroupStatus = 'completed' | 'confirming' | 'unallocated';

function ReceiptHandoverGroupStatusIcon({
  status,
  label,
}: {
  status: ReceiptHandoverGroupStatus;
  label: string;
}) {
  const Icon =
    status === 'completed'
      ? CircleCheck
      : status === 'confirming'
        ? CircleEllipsis
        : CircleDashed;
  const colorClassName =
    status === 'completed'
      ? 'text-[var(--color-success-accent,var(--color-green-600))]'
      : status === 'confirming'
        ? 'text-[var(--color-warning-accent,var(--color-yellow-500))]'
        : 'text-muted-foreground';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={label}
          className="inline-flex shrink-0 cursor-help"
          role="img"
          tabIndex={0}
        >
          <Icon aria-hidden="true" className={`size-5 ${colorClassName}`} />
        </span>
      </TooltipTrigger>
      <TooltipContent
        variant={
          status === 'completed'
            ? 'success'
            : status === 'confirming'
              ? 'warning'
              : 'light'
        }
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ReceiptHandoverGroupTable({
  handovers,
  onView,
  emptyMessage,
}: {
  handovers: HandoverDocument[];
  onView: (handover: HandoverDocument) => void;
  emptyMessage: string;
}) {
  const columns = useHandoverDocumentColumns({ onView, showViewLabel: true });
  const table = useReactTable({
    data: handovers,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnVisibility: {
        type: false,
        senderParty: false,
        recipientParty: false,
      },
    },
  });

  return (
    <DataGrid
      table={table}
      recordCount={handovers.length}
      emptyMessage=""
      tableLayout={{
        headerSticky: false,
      }}
    >
      {handovers.length ? (
        <div className="overflow-x-auto">
          <DataGridTable />
        </div>
      ) : (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      )}
    </DataGrid>
  );
}

function getAllocationChartColor(id: string, index: number) {
  let hash = 2166136261;
  for (const character of id) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  const seed = hash >>> 0;
  const hue = (seed + index * 137.508) % 360;
  const saturation = 60 + ((seed >>> 8) % 16);
  const lightness = 42 + ((seed >>> 16) % 9);
  return `hsl(${hue.toFixed(0)} ${saturation}% ${lightness}%)`;
}

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
  const custodianDirectoryQuery = useCustodiansQuery(
    true,
    isPermissionsPending || canRead,
  );
  const requestRegistrationScopeOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: 'all',
        label: intl.formatMessage({
          id: 'receipts.requestRegistration.all',
        }),
      },
      {
        value: 'selected',
        label: intl.formatMessage({
          id: 'receipts.requestRegistration.selected',
        }),
      },
    ],
    [intl],
  );
  const epsUnits = useMemo<EpsUnitSelectionItem[]>(
    () =>
      (custodianDirectoryQuery.data ?? [])
        .filter(
          (party) =>
            party.isActive &&
            party.type === 'department' &&
            party.sourceType === 'eps_department',
        )
        .map((party) => ({
          id: party.id,
          name: party.name,
          code: party.code,
        })),
    [custodianDirectoryQuery.data],
  );
  const modelsQuery = useMaterialModelsQuery(isPermissionsPending || canRead);
  const materialGroupsQuery = useMaterialGroupsQuery(
    isPermissionsPending || canRead,
  );
  const saveMutation = useSaveMaterialReceiptMutation();
  const actionMutation = useMaterialReceiptActionMutation();
  const excelImportMutation = useImportMaterialReceiptFromExcelMutation();
  const deleteMutation = useDeleteMaterialReceiptMutation();
  const inlinePreviewMutation = useMaterialReceiptInlineUpdatePreviewMutation();
  const inlineApplyMutation = useApplyMaterialReceiptInlineUpdateMutation();
  const [actionDialog, setActionDialog] = useState<
    'confirm' | 'complete' | 'reopen' | 'cancel' | null
  >(null);
  const [actionReason, setActionReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [epsUnitSelectionOpen, setEpsUnitSelectionOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(
    searchParams.get('step') === '2' ? 2 : 1,
  );
  const [confirmStepOpen, setConfirmStepOpen] = useState(false);
  const [expandedHandoverGroupIds, setExpandedHandoverGroupIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [preview, setPreview] =
    useState<MaterialReceiptInlineUpdatePreview | null>(null);
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
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
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
    (receipt && receipt.status !== 'draft' && receipt.status !== 'handover'),
  );
  const handoversQuery = useHandoversQuery(
    {
      receiptId: id || undefined,
      page: 1,
      pageSize: HANDOVER_GROUP_PAGE_SIZE,
    },
    Boolean(id) && activeStep === 2 && canRead,
  );
  const handoverPageCount = Math.ceil(
    (handoversQuery.data?.total ?? 0) / HANDOVER_GROUP_PAGE_SIZE,
  );
  const remainingHandoverPages = useQueries({
    queries: Array.from(
      { length: Math.max(0, handoverPageCount - 1) },
      (_, index) => {
        const filters = {
          receiptId: id || undefined,
          page: index + 2,
          pageSize: HANDOVER_GROUP_PAGE_SIZE,
        };
        return {
          queryKey: handoverKeys.list(filters),
          queryFn: ({ signal }: { signal: AbortSignal }) =>
            loadHandovers(filters, signal),
          enabled: Boolean(id) && activeStep === 2 && canRead,
          retry: 0,
        };
      },
    ),
  });
  const handovers = [
    ...(handoversQuery.data?.items ?? []),
    ...remainingHandoverPages.flatMap((page) => page.data?.items ?? []),
  ];
  const handoversLoading =
    handoversQuery.isPending ||
    remainingHandoverPages.some((page) => page.isPending);
  const handoversFetching =
    handoversQuery.isFetching ||
    remainingHandoverPages.some((page) => page.isFetching);
  const handoversError =
    handoversQuery.isError ||
    remainingHandoverPages.some((page) => page.isError);
  const onViewHandover = useCallback((handover: (typeof handovers)[number]) => {
    const path = ROUTES.PROJECT.HANDOVER_DETAIL.replace(':id', handover.id);
    window.open(toAbsoluteUrl(path), '_blank', 'noopener,noreferrer');
  }, []);
  const warehouses = warehousesQuery.data ?? [];
  const custodians = custodianDirectoryQuery.data ?? EMPTY_CUSTODIANS;
  const warehouseCustodian = custodians.find(
    (party) => party.id === receipt?.warehouseId,
  );
  const canAllocate = Boolean(
    hasPermission(HANDOVER_PERMISSION_CODES.manage) &&
    warehouseCustodian &&
    receipt?.status === 'handover' &&
    (warehouseCustodian.canRepresent ||
      (userId &&
        (warehouseCustodian.accountUserId === userId ||
          warehouseCustodian.accountUserIds.includes(userId) ||
          warehouseCustodian.representativeUserId === userId))),
  );
  const eligibleReceivingParties = useMemo(
    () =>
      custodians.filter(
        (party) =>
          party.isActive &&
          party.type !== 'warehouse' &&
          party.type !== 'other',
      ),
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
      {
        name: string;
        code: string;
        groupId?: string | null;
        imageUrl?: string | null;
      }
    >();
    for (const line of receipt?.lines ?? []) {
      if (!line.modelId) continue;
      models.set(line.modelId, {
        name: line.model.name,
        code: line.model.code ?? '',
        groupId: line.model.groupId,
      });
    }
    for (const model of modelsQuery.data ?? []) {
      models.set(model.id, {
        name: model.name,
        code: model.code,
        groupId: model.groupId,
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
          representative.materialValues.nameOverride?.trim() ?? '',
        ]),
      ),
    [representatives],
  );
  const watchedLines = form.watch('lines');
  const selectedGroupIds = useMemo(
    () =>
      selectedGroupId
        ? getMaterialGroupDescendantIds(
            materialGroupsQuery.data ?? [],
            selectedGroupId,
          )
        : null,
    [materialGroupsQuery.data, selectedGroupId],
  );
  const receiptMaterialCountsByGroup = useMemo(() => {
    const groupsById = new Map(
      (materialGroupsQuery.data ?? []).map((group) => [group.id, group]),
    );
    const counts = new Map<string, number>();
    for (const line of watchedLines) {
      const groupId = modelById.get(line.modelId)?.groupId;
      const quantity = Math.max(0, Number(line.quantity) || 0);
      if (!groupId || quantity === 0) continue;

      const visited = new Set<string>();
      let group = groupsById.get(groupId);
      while (group && !visited.has(group.id)) {
        visited.add(group.id);
        counts.set(group.id, (counts.get(group.id) ?? 0) + quantity);
        group = group.parentId ? groupsById.get(group.parentId) : undefined;
      }
    }
    return counts;
  }, [materialGroupsQuery.data, modelById, watchedLines]);
  const saveBusy =
    saveMutation.isPending ||
    excelImportMutation.isPending ||
    inlinePreviewMutation.isPending ||
    inlineApplyMutation.isPending;
  const previewPending = inlinePreviewMutation.isPending;
  const previewDialogProcessing =
    previewPending || (inlineApplyMutation.isPending && preview === null);
  const totalMaterialCount = watchedLines.reduce(
    (total, line) => total + Math.max(0, Number(line.quantity) || 0),
    0,
  );
  const requestRegistrationScope = form.watch('requestRegistrationScope');
  const requestRegistrationPartyIds = form.watch('requestRegistrationPartyIds');
  const handoverGroups = (() => {
    const groups = new Map<string, ReceiptHandoverGroup>();
    const partiesById = new Map(custodians.map((party) => [party.id, party]));
    const epsUnitsById = new Map(epsUnits.map((unit) => [unit.id, unit]));
    const ensureGroup = (
      partyId: string,
      fallback?: HandoverDocument['recipientParty'],
    ) => {
      const party = partiesById.get(partyId);
      const unit = epsUnitsById.get(partyId);
      const existing = groups.get(partyId);
      if (existing) return existing;
      const group = {
        id: partyId,
        code: party?.code ?? unit?.code ?? fallback?.code ?? '',
        name: party?.name ?? unit?.name ?? fallback?.name ?? partyId,
        allocatedQuantity: 0,
        handovers: [],
      };
      groups.set(partyId, group);
      return group;
    };

    for (const line of watchedLines) {
      const partyId = line.receivingPartyId;
      if (!partyId) continue;
      ensureGroup(partyId).allocatedQuantity += Math.max(
        0,
        Number(line.quantity) || 0,
      );
    }
    if (requestRegistrationScope === 'selected') {
      for (const partyId of requestRegistrationPartyIds) ensureGroup(partyId);
    }
    for (const handover of handovers) {
      const partyId = handover.recipientParty.id;
      if (!partyId) continue;
      ensureGroup(partyId, handover.recipientParty).handovers.push(handover);
    }

    return [...groups.values()].sort((left, right) =>
      left.name.localeCompare(right.name, 'vi'),
    );
  })();
  const allocationChartData = useMemo(() => {
    const quantityByReceivingParty = new Map<string, number>();
    for (const line of watchedLines) {
      const quantity = Math.max(0, Number(line.quantity) || 0);
      if (!line.receivingPartyId || quantity === 0) continue;
      quantityByReceivingParty.set(
        line.receivingPartyId,
        (quantityByReceivingParty.get(line.receivingPartyId) ?? 0) + quantity,
      );
    }

    const listedQuantities = new Map(quantityByReceivingParty);
    if (requestRegistrationScope === 'selected') {
      for (const partyId of requestRegistrationPartyIds) {
        if (!listedQuantities.has(partyId)) listedQuantities.set(partyId, 0);
      }
    }

    const partiesById = new Map(custodians.map((party) => [party.id, party]));
    const partyPoints = [...listedQuantities.entries()]
      .map(([id, value]) => ({
        id,
        name:
          partiesById.get(id)?.name ??
          intl.formatMessage({
            id: 'receipts.allocation.unknownReceivingParty',
          }),
        value,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, 'vi'))
      .map((point, index) => ({
        name: point.name,
        value: point.value,
        fill: getAllocationChartColor(point.id, index),
      }));
    const chartPartyPoints = partyPoints.filter((point) => point.value > 0);
    const allocatedCount = partyPoints.reduce(
      (total, point) => total + point.value,
      0,
    );
    const unallocatedCount = Math.max(0, totalMaterialCount - allocatedCount);
    const points = chartPartyPoints.map((point) => ({ ...point }));
    const displayPoints =
      requestRegistrationScope === 'selected'
        ? partyPoints.map((point) => ({ ...point }))
        : chartPartyPoints.map((point) => ({ ...point }));
    if (unallocatedCount > 0) {
      const unallocatedPoint = {
        name: intl.formatMessage({ id: 'receipts.allocation.unallocated' }),
        value: unallocatedCount,
        fill: 'var(--admin-chart-empty)',
      };
      points.push(unallocatedPoint);
      displayPoints.push(unallocatedPoint);
    }
    return {
      points,
      displayPoints,
      allocatedCount,
      objectCount: quantityByReceivingParty.size,
    };
  }, [
    custodians,
    intl,
    requestRegistrationPartyIds,
    requestRegistrationScope,
    totalMaterialCount,
    watchedLines,
  ]);
  const chartAllocationPercent = totalMaterialCount
    ? Math.min(
        100,
        Math.floor(
          (allocationChartData.allocatedCount / totalMaterialCount) * 100,
        ),
      )
    : 0;
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
  const navigateToAllocationHandover = useCallback(
    (recipientPartyId?: string) => {
      if (!receipt) return;
      const search = new URLSearchParams({
        mode: 'warehouse_allocation',
        receiptId: receipt.id,
        warehouseId: receipt.warehouseId,
      });
      if (recipientPartyId) search.set('recipientPartyId', recipientPartyId);
      navigate(`${ROUTES.PROJECT.HANDOVER_CREATE}?${search.toString()}`);
    },
    [navigate, receipt],
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
      const selectedRegistrationPartyIds = new Set(
        form.getValues('requestRegistrationPartyIds'),
      );
      const epsDepartmentIds = new Set(
        custodians
          .filter(
            (party) =>
              party.type === 'department' &&
              party.sourceType === 'eps_department',
          )
          .map((party) => party.id),
      );
      for (const { values } of rows) {
        if (epsDepartmentIds.has(values.ownerPartyId)) {
          selectedRegistrationPartyIds.add(values.ownerPartyId);
        }
      }
      if (
        selectedRegistrationPartyIds.size !==
        form.getValues('requestRegistrationPartyIds').length
      ) {
        form.setValue(
          'requestRegistrationPartyIds',
          [...selectedRegistrationPartyIds],
          { shouldDirty: true, shouldValidate: true },
        );
      }
    },
    [custodians, form, modelsQuery.data],
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
      id ||
      receipt ||
      isPermissionsPending ||
      !canManage ||
      !warehousesQuery.isFetchedAfterMount ||
      form.getValues('warehouseId') ||
      warehousesQuery.data?.length !== 1
    ) {
      return;
    }

    form.setValue('warehouseId', warehousesQuery.data[0].id);
  }, [
    canManage,
    form,
    id,
    isPermissionsPending,
    receipt,
    warehousesQuery.data,
    warehousesQuery.isFetchedAfterMount,
  ]);

  useEffect(() => {
    if (!receipt || searchParams.has('step') || receipt.status !== 'handover') {
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
  }, [receipt, searchParams, setSearchParams]);

  const applyInlineUpdate = (
    result: MaterialReceiptInlineUpdatePreview,
    lines: MaterialReceiptLineInput[],
  ) => {
    if (!receipt) return;
    const requestRegistrationScope = form.getValues('requestRegistrationScope');
    inlineApplyMutation.mutate(
      {
        id: receipt.id,
        expectedVersion: receipt.version,
        previewToken: result.previewToken,
        warehouseId: result.warehouseId,
        note: form.getValues('note'),
        lines,
        requestRegistrationScope,
        requestRegistrationPartyIds:
          requestRegistrationScope === 'selected'
            ? form.getValues('requestRegistrationPartyIds')
            : [],
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
    if (receipt?.status === 'handover' && !hasUnsavedChanges) {
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
    if (!afterStepConfirmation && receipt?.status !== 'handover') {
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
      receipt?.status === 'handover',
      receipt?.status === 'handover',
      representativesForReceipt,
    );
    if (receipt?.status === 'handover') {
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
      !custodianDirectoryQuery.isPending &&
      !custodianDirectoryQuery.isError &&
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
    if (hasExcelImportLines && !id) {
      excelImportMutation.mutate(
        {
          actorUserId: userId ?? '',
          values: {
            warehouseId: values.warehouseId,
            note: values.note,
            requestRegistrationScope: values.requestRegistrationScope,
            requestRegistrationPartyIds:
              values.requestRegistrationScope === 'selected'
                ? values.requestRegistrationPartyIds
                : [],
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
              `${ROUTES.PROJECT.RECEIPT_EDIT.replace(':id', savedId)}?step=2`,
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
          requestRegistrationScope: values.requestRegistrationScope,
          requestRegistrationPartyIds:
            values.requestRegistrationScope === 'selected'
              ? values.requestRegistrationPartyIds
              : [],
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
              `${ROUTES.PROJECT.RECEIPT_EDIT.replace(':id', savedId)}?step=2`,
              { replace: true },
            );
          }
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  const submitReceiptAction = () => {
    if (!receipt || !actionDialog) return;
    const reason = actionReason.trim();
    if ((actionDialog === 'cancel' || actionDialog === 'reopen') && !reason)
      return;
    actionMutation.mutate(
      {
        id: receipt.id,
        action: actionDialog,
        expectedVersion: receipt.version,
        reason,
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
          setActionReason('');
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  const deleteReceipt = () => {
    if (!receipt) return;
    deleteMutation.mutate(
      { id: receipt.id, expectedVersion: receipt.version },
      {
        onSuccess: () => {
          toast.success(intl.formatMessage({ id: 'receipts.toasts.deleted' }));
          setDeleteDialogOpen(false);
          navigate(ROUTES.PROJECT.RECEIPTS);
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  const header = useMemo(
    () => ({
      title: receipt?.code
        ? intl.formatMessage(
            { id: 'receipts.page.titleWithCode' },
            { code: receipt.code },
          )
        : intl.formatMessage({ id: 'receipts.dialogs.formTitle' }),
      icon: PROJECT_FEATURE_ICONS.receipts,
      showBackButton: true,
      backLabel: intl.formatMessage({ id: 'receipts.actions.back' }),
      onBack: navigateBack,
      actions: (
        <div className="flex flex-wrap gap-2">
          {!readOnly && (activeStep === 1 || hasUnsavedChanges) ? (
            <Button
              type="submit"
              form="materialReceipt-form"
              variant="primary"
              size="md"
              loading={saveBusy}
              loadingText={intl.formatMessage({
                id: 'receipts.handover.steps.saveAndContinue',
              })}
            >
              <Save className="size-4" />
              {intl.formatMessage({
                id: 'receipts.handover.steps.saveAndContinue',
              })}
            </Button>
          ) : null}
          {receipt?.status === 'draft' && canManage ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={actionMutation.isPending}
                onClick={() => {
                  setActionReason('');
                  setActionDialog('confirm');
                }}
              >
                <CircleCheck className="size-4" />
                {intl.formatMessage({ id: 'receipts.actions.confirm' })}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="md"
                disabled={actionMutation.isPending}
                onClick={() => {
                  setActionReason('');
                  setActionDialog('cancel');
                }}
              >
                <X className="size-4" />
                {intl.formatMessage({ id: 'receipts.actions.cancel' })}
              </Button>
            </>
          ) : null}
          {receipt?.status === 'handover' ? (
            <>
              {canManage ? (
                <Button
                  type="button"
                  variant="success"
                  size="md"
                  disabled={actionMutation.isPending}
                  onClick={() => {
                    setActionReason('');
                    setActionDialog('complete');
                  }}
                >
                  <CircleCheck className="size-4" />
                  {intl.formatMessage({ id: 'receipts.actions.complete' })}
                </Button>
              ) : null}
            </>
          ) : null}
          {receipt?.status === 'completed' && canManage ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={actionMutation.isPending}
              onClick={() => {
                setActionReason('');
                setActionDialog('reopen');
              }}
            >
              <RotateCcw className="size-4" />
              {intl.formatMessage({ id: 'receipts.actions.reopen' })}
            </Button>
          ) : null}
          {receipt && canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  mode="icon"
                  size="icon"
                  aria-label={intl.formatMessage({
                    id: 'receipts.actions.more',
                  })}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 />
                  {intl.formatMessage({ id: 'receipts.actions.delete' })}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ),
    }),
    [
      actionMutation.isPending,
      activeStep,
      canManage,
      hasUnsavedChanges,
      intl,
      navigateBack,
      readOnly,
      receipt,
      saveBusy,
      setDeleteDialogOpen,
      setActionDialog,
      setActionReason,
    ],
  );
  useDetailEntryLayoutHeader(header);

  if (isPermissionsPending) {
    return (
      <PageLoading label={intl.formatMessage({ id: 'common.state.loading' })} />
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
      <PageLoading label={intl.formatMessage({ id: 'common.state.loading' })} />
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
    return (
      <PageLoading label={intl.formatMessage({ id: 'common.state.loading' })} />
    );
  const createLine = createMaterialReceiptLine;
  const selectedDrawerFormLine =
    activeMaterialLine === null
      ? null
      : form.watch(`lines.${activeMaterialLine}`);
  const selectedDrawerModel = modelsQuery.data?.find(
    (model) => model.id === selectedDrawerFormLine?.modelId,
  );

  const receiptDetailsCard = (
    <Card className="min-w-0">
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
          requestRegistrationScopeOptions={requestRegistrationScopeOptions}
          warehouseReadOnly={readOnly || receipt?.status === 'handover'}
          onEditRequestRegistrationParties={() => setEpsUnitSelectionOpen(true)}
        />
      </CardContent>
    </Card>
  );

  const receiptAllocationCard = (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>
          {intl.formatMessage({ id: 'receipts.allocation.summaryTitle' })}
        </CardTitle>
        <Badge variant="secondary" appearance="light" size="md">
          {intl.formatMessage(
            { id: 'receipts.allocation.objectCount' },
            { count: allocationChartData.objectCount },
          )}
        </Badge>
      </CardHeader>
      <CardContent className="grid min-h-[15rem] items-center gap-4 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.9fr)]">
        <div className="relative mx-auto w-full max-w-56">
          <MaterialReceiptAllocationChart
            data={allocationChartData.points}
            isEmpty={totalMaterialCount === 0}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-metric font-semibold tabular-nums text-foreground">
              {intl.formatNumber(chartAllocationPercent)}%
            </span>
            <span className="max-w-24 text-xs text-muted-foreground">
              {intl.formatMessage({ id: 'receipts.columns.progress' })}
            </span>
          </div>
        </div>
        <div className="divide-y divide-border">
          {allocationChartData.displayPoints.map((point, index) => (
            <div
              key={`${point.name}-${index}`}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2 text-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: point.fill }}
                  aria-hidden="true"
                />
                <span className="truncate">{point.name}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {intl.formatMessage(
                  { id: 'receipts.handover.steps.materialCount' },
                  { count: point.value },
                )}
              </span>
            </div>
          ))}
          {allocationChartData.displayPoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {intl.formatMessage({ id: 'receipts.allocation.empty' })}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  const receiptOverview = (
    <div className="grid min-w-0 shrink-0 gap-4 lg:grid-cols-2">
      {receiptDetailsCard}
      {receiptAllocationCard}
    </div>
  );

  const editorContent = (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 xl:flex-row">
        {materialGroupsQuery.isError ? (
          <Card className="h-72 min-h-0 w-full overflow-hidden xl:h-full xl:w-72 xl:shrink-0">
            <CardContent className="p-4">
              <ErrorState
                title={intl.formatMessage({
                  id: 'materialGroups.errors.loadTitle',
                })}
                description={getApiErrorMessage(materialGroupsQuery.error)}
                onRetry={() => void materialGroupsQuery.refetch()}
              />
            </CardContent>
          </Card>
        ) : materialGroupsQuery.isPending ? (
          <Card className="h-72 min-h-0 w-full overflow-hidden xl:h-full xl:w-72 xl:shrink-0">
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-4/5" />
              <Skeleton className="h-8 w-3/4" />
            </CardContent>
          </Card>
        ) : (
          <MaterialGroupFilterSidebar
            id="material-receipt-group-filter-tree"
            isOpen
            groups={materialGroupsQuery.data ?? []}
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
            countByNode={receiptMaterialCountsByGroup}
            allCount={totalMaterialCount}
            hideEmptyGroups
          />
        )}
        <Card className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <MaterialReceiptLinesEditorTable
            form={form}
            createLine={createLine}
            modelById={modelById}
            materialNameByClientId={materialNameByClientId}
            filterGroupIds={selectedGroupIds}
            receivingParties={custodians}
            receivingPartySelectionDisabled={
              readOnly || !selectedWarehouseId || saveBusy
            }
            readOnly={readOnly}
            toolbarContent={
              !readOnly ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    disabled={saveBusy}
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
      </div>
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
        readOnly={readOnly}
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
        receiptRecipientOptionsLoading={custodianDirectoryQuery.isFetching}
        receiptRecipientOptionsError={custodianDirectoryQuery.isError}
        onRetryReceiptRecipientOptions={() =>
          void custodianDirectoryQuery.refetch()
        }
      />
      <MaterialReceiptRecipientDialog
        open={Boolean(activeReceivingLine)}
        onOpenChange={(open) => !open && setActiveReceivingLineClientId(null)}
        value={activeReceivingLine?.receivingPartyId ?? ''}
        options={receivingPartyOptions}
        loading={custodianDirectoryQuery.isFetching}
        error={
          custodianDirectoryQuery.isError
            ? getApiErrorMessage(custodianDirectoryQuery.error)
            : undefined
        }
        onRetry={() => void custodianDirectoryQuery.refetch()}
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
                id: 'receipts.dialogs.inlineUpdateTitle',
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
                  receipt?.status === 'handover' ? (
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
                    previewPending || inlineApplyMutation.isPending
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
                loading={inlineApplyMutation.isPending}
                loadingText={intl.formatMessage({
                  id: 'receipts.inlineUpdate.apply',
                })}
                disabled={
                  !preview ||
                  saveBusy ||
                  preview.blockedItems.length > 0 ||
                  confirmedHandoverIds.size !== preview.affectedHandovers.length
                }
                onClick={() => {
                  if (!receipt || !preview) return;
                  applyInlineUpdate(preview, previewLines);
                }}
              >
                {intl.formatMessage({
                  id: 'receipts.inlineUpdate.apply',
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
      {receiptOverview}
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
            <CardTable className="min-h-0 flex-1">
              {handoversError ? (
                <ErrorState
                  title={intl.formatMessage({
                    id: 'receipts.errors.loadHandoversTitle',
                  })}
                  description={getApiErrorMessage(
                    handoversQuery.error ??
                      remainingHandoverPages.find((page) => page.error)?.error,
                  )}
                  onRetry={() =>
                    void Promise.all([
                      handoversQuery.refetch(),
                      ...remainingHandoverPages.map((page) => page.refetch()),
                    ])
                  }
                />
              ) : handoversLoading ? (
                <div className="space-y-3 p-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="space-y-2 p-3">
                    {handoverGroups.map((group) => {
                      const expanded = expandedHandoverGroupIds.has(group.id);
                      const status: ReceiptHandoverGroupStatus =
                        group.handovers.length === 0
                          ? 'unallocated'
                          : group.handovers.every(
                                (handover) => handover.status === 'completed',
                              )
                            ? 'completed'
                            : 'confirming';
                      return (
                        <Card key={group.id} className="overflow-hidden">
                          <div className="flex min-w-0 items-center gap-3 p-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={intl.formatMessage(
                                { id: 'receipts.handoverGroups.toggle' },
                                { unit: group.name },
                              )}
                              aria-expanded={expanded}
                              onClick={() =>
                                setExpandedHandoverGroupIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(group.id)) next.delete(group.id);
                                  else next.add(group.id);
                                  return next;
                                })
                              }
                            >
                              {expanded ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                            </Button>
                            <ReceiptHandoverGroupStatusIcon
                              status={status}
                              label={intl.formatMessage({
                                id: `receipts.handoverGroups.status.${status}`,
                              })}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-baseline gap-2">
                                <p className="truncate text-sm font-semibold">
                                  {group.name}
                                </p>
                                {group.code ? (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {group.code}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                <span>
                                  {intl.formatMessage(
                                    {
                                      id: 'receipts.handoverGroups.allocatedSummary',
                                    },
                                    {
                                      count:
                                        group.allocatedQuantity.toLocaleString(
                                          intl.locale,
                                        ),
                                    },
                                  )}
                                </span>
                                <span className="text-muted-foreground">·</span>
                                <span>
                                  {intl.formatMessage(
                                    {
                                      id: 'receipts.handoverGroups.handoverSummary',
                                    },
                                    {
                                      count:
                                        group.handovers.length.toLocaleString(
                                          intl.locale,
                                        ),
                                    },
                                  )}
                                </span>
                              </div>
                            </div>
                            {canAllocate ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  navigateToAllocationHandover(group.id)
                                }
                              >
                                <Plus className="size-4" />
                                {intl.formatMessage({
                                  id: 'receipts.actions.linkedHandover',
                                })}
                              </Button>
                            ) : null}
                          </div>
                          {expanded ? (
                            <div className="border-t border-border bg-muted/20 px-3 py-3 sm:pl-10">
                              <div className="overflow-hidden rounded-md border border-border bg-card">
                                <ReceiptHandoverGroupTable
                                  handovers={group.handovers}
                                  onView={onViewHandover}
                                  emptyMessage={intl.formatMessage({
                                    id: 'receipts.handoverGroups.empty',
                                  })}
                                />
                              </div>
                            </div>
                          ) : null}
                        </Card>
                      );
                    })}
                    {!handoverGroups.length ? (
                      <p className="py-5 text-center text-sm text-muted-foreground">
                        {intl.formatMessage({
                          id: 'receipts.handoverGroups.noUnits',
                        })}
                      </p>
                    ) : null}
                  </div>
                </ScrollArea>
              )}
            </CardTable>
            {handoversFetching && !handoversLoading ? (
              <CardFooter className="justify-end text-xs text-muted-foreground">
                {intl.formatMessage({ id: 'common.updating' })}
              </CardFooter>
            ) : null}
          </Card>
        </StepperContent>
      </Stepper>
      <EpsUnitSelectionDialog
        open={epsUnitSelectionOpen}
        onOpenChange={setEpsUnitSelectionOpen}
        units={epsUnits}
        selectedIds={form.watch('requestRegistrationPartyIds')}
        onConfirm={(selectedIds) =>
          form.setValue('requestRegistrationPartyIds', selectedIds, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
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
              {intl.formatMessage(
                { id: 'receipts.confirm.completeWarning' },
                { count: receipt?.pendingAllocationItems ?? 0 },
              )}
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
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                rows={3}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={actionMutation.isPending}
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
                !actionReason.trim()
              }
              onClick={submitReceiptAction}
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
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={intl.formatMessage({ id: 'receipts.dialogs.deleteTitle' })}
        description={intl.formatMessage({
          id: 'receipts.dialogs.deleteDescription',
        })}
        confirmLabel={intl.formatMessage({ id: 'receipts.actions.delete' })}
        cancelLabel={intl.formatMessage({ id: 'common.actions.cancel' })}
        confirmVariant="destructive"
        isConfirming={deleteMutation.isPending}
        onConfirm={deleteReceipt}
      />
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
