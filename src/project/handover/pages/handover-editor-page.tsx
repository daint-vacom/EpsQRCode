import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ROUTES } from '@/constants/routes';
import {
  useCustodiansQuery,
  useHandoverCounterpartyOptionsQuery,
} from '@/project/custodians/hooks/use-custodians';
import { uploadFilesToFolder } from '@/project/files/api/file-manager.api';
import { HandoverAttachmentsField } from '@/project/handover/components/handover-attachments-field';
import { HandoverPartyCard } from '@/project/handover/components/handover-party-card';
import { HandoverItemsEditorTable } from '@/project/handover/table/handover-items-editor-table.generated';
import { useMaterialsByIdsQuery } from '@/project/materials/hooks/use-materials';
import type { MaterialListFilters } from '@/project/materials/model/material';
import {
  ArrowRight,
  CalendarDays,
  FilePlus2,
  FileText,
  Package,
  Save,
  Send,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { OptionSelect } from '@/components/ui/option-select';
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
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import {
  mapHandoverToFormValues,
  useHandoverForm,
} from '../forms/handover-form.generated';
import {
  useHandoverActionMutation,
  useHandoverHistoryQuery,
  useHandoverQuery,
  useSaveHandoverMutation,
} from '../hooks/use-handovers';
import type {
  HandoverAttachment,
  HandoverDocument,
  HandoverHistoryEntry,
  HandoverType,
} from '../model/handover';
import type { HandoverFormValues } from '../model/handover-form-schema';
import { HANDOVER_PERMISSION_CODES } from '../model/handover-permissions';
import { HandoverDetailPage } from './handover-detail-page';

function MetadataIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      {children}
    </span>
  );
}

function isUuid(value: string) {
  return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
    value,
  );
}

type HandoverSignatureSide = 'sender' | 'recipient';
type HandoverSignatureState = 'pending' | 'signed' | 'rejected';

function latestHistoryEntry(
  entries: HandoverHistoryEntry[],
  actions: HandoverHistoryEntry['action'][],
) {
  return [...entries].reverse().find((entry) => actions.includes(entry.action));
}

function getSignatureInfo(
  document: HandoverDocument | undefined,
  entries: HandoverHistoryEntry[],
  side: HandoverSignatureSide,
) {
  if (!document || document.status === 'cancelled') {
    return { state: 'pending' as const, entry: undefined };
  }

  const lastEditIndex = entries
    .map((entry) => entry.action)
    .lastIndexOf('updated');
  const currentEntries =
    lastEditIndex >= 0 ? entries.slice(lastEditIndex + 1) : entries;

  const rejection = latestHistoryEntry(currentEntries, ['rejected']);
  const rejectionSide =
    document.mode === 'warehouse_request' ? 'sender' : 'recipient';
  if (document.status === 'rejected' && side === rejectionSide) {
    return {
      state: 'rejected' as const,
      entry: rejection,
    };
  }

  const signatureActions =
    side === 'sender'
      ? document.mode === 'standard'
        ? (['sent', 'confirmed_offline'] as const)
        : (['warehouse_approved'] as const)
      : document.mode === 'warehouse_request'
        ? (['confirmed', 'sent'] as const)
        : (['confirmed'] as const);
  const signature = latestHistoryEntry(currentEntries, [...signatureActions]);
  if (signature) return { state: 'signed' as const, entry: signature };

  const signedByStatus =
    side === 'sender'
      ? document.mode !== 'standard'
        ? ['pending', 'completed'].includes(document.status)
        : ['pending', 'completed', 'rejected'].includes(document.status) ||
          document.status === 'awaiting_warehouse_approval'
      : document.mode === 'warehouse_request'
        ? [
            'awaiting_warehouse_approval',
            'pending',
            'completed',
            'rejected',
          ].includes(document.status)
        : document.status === 'completed' &&
          (document.mode !== 'standard' || document.recipientHasQrAccount);
  return {
    state: signedByStatus ? ('signed' as const) : ('pending' as const),
    entry: undefined,
  };
}

function formatSignatureTimestamp(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
}

export function HandoverEditorPage() {
  const intl = useIntl();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id = '' } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { userId, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canManage = hasPermission(HANDOVER_PERMISSION_CODES.manage);
  const canView = hasPermission(HANDOVER_PERMISSION_CODES.view);
  const documentQuery = useHandoverQuery(id, isEdit && (canManage || canView));
  const document = documentQuery.data;
  const historyQuery = useHandoverHistoryQuery(
    id,
    isEdit && (canManage || canView),
  );
  const historyEntries = historyQuery.data ?? [];
  const isReadOnly = Boolean(
    isEdit &&
    (!canManage ||
      document?.status !== 'draft' ||
      document?.mode !== 'standard'),
  );
  const reverseFromHandoverId =
    new URLSearchParams(location.search).get('reverseFrom') ?? '';
  const reverseSourceQuery = useHandoverQuery(
    reverseFromHandoverId,
    !isEdit && Boolean(reverseFromHandoverId) && canManage,
  );
  const custodiansQuery = useCustodiansQuery(false, canManage || canView);
  const saveMutation = useSaveHandoverMutation();
  const actionMutation = useHandoverActionMutation();
  const { mutateAsync: saveHandover, isPending: isSaving } = saveMutation;
  const { mutateAsync: actOnHandover, isPending: isActing } = actionMutation;
  const initialMaterialSearch =
    new URLSearchParams(location.search).get('materialId') ?? '';
  const bulkMaterialIds = useMemo(() => {
    const values = new URLSearchParams(location.search)
      .get('materialIds')
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return [...new Set(values ?? [])];
  }, [location.search]);
  const bulkMaterialsQuery = useMaterialsByIdsQuery(
    bulkMaterialIds,
    canManage && !isEdit,
  );
  const processedBulkMaterialIds = useRef(new Set<string>());
  const processedBulkSenderPrefill = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState<File[]>(
    [],
  );
  const [uploadedAttachments, setUploadedAttachments] = useState<
    HandoverAttachment[]
  >([]);
  const approvalActionsTargetRef = useRef<HTMLDivElement>(null);
  const form = useHandoverForm();
  const [activeStep, setActiveStep] = useState(
    searchParams.get('step') === '2' ? 2 : 1,
  );
  const lastSenderPartyIdRef = useRef<string | null>(null);
  const senderSelectionInitializedRef = useRef(false);
  const selectedMaterialIds = (form.watch('items') ?? [])
    .map((item) => item.materialId)
    .filter(isUuid);
  const selectedMaterialsQuery = useMaterialsByIdsQuery(
    [...new Set(selectedMaterialIds)],
    canManage && !isReadOnly,
  );
  const reverseSource = reverseSourceQuery.data;
  const custodianList = useMemo(
    () =>
      (custodiansQuery.data ?? []).filter(
        (party) => party.type !== 'warehouse',
      ),
    [custodiansQuery.data],
  );
  const selectedSenderPartyId = form.watch('senderPartyId');
  const selectedSenderPartyName = form.watch('senderPartyName');
  const hasSenderForItems = Boolean(
    selectedSenderPartyId || (isReadOnly && selectedSenderPartyName),
  );
  const selectedSenderScopePartyId = form.watch('senderPartyScopePartyId');
  const senderCatalogIdForCounterparties =
    form.watch('senderPartyKind') === 'other'
      ? selectedSenderScopePartyId
      : selectedSenderPartyId;
  const counterpartiesQuery = useHandoverCounterpartyOptionsQuery(
    senderCatalogIdForCounterparties,
    canManage && !isReadOnly,
  );
  const recipientCatalogParties = useMemo(() => {
    const knownIds = new Set(custodianList.map((party) => party.id));
    return [
      ...custodianList,
      ...(counterpartiesQuery.data ?? [])
        .filter(
          (party) => party.type !== 'warehouse' && !knownIds.has(party.id),
        )
        .map((party) => ({
          ...party,
          parentId: party.parentId ?? null,
          sourceType: null,
          sourceId: null,
          canRepresent: false,
          canManageHandover: false,
          accountUserId: null,
          accountUserIds: [],
          representativeUserId: null,
          representativeDisplayName: null,
          representativeName: party.representativeName ?? null,
          phone: party.phone ?? null,
          email: party.email ?? null,
          isHandoverCustom: false,
          handoverScopePartyId: null,
          isActive: true,
          createdAt: '',
          updatedAt: '',
        })),
    ];
  }, [counterpartiesQuery.data, custodianList]);
  const handoverType = form.watch('type');
  const materialFilters: Omit<
    MaterialListFilters,
    'search' | 'page' | 'pageSize'
  > = {
    ownerPartyId:
      handoverType === 'return'
        ? undefined
        : form.watch('senderPartyKind') === 'other'
          ? undefined
          : form.watch('senderPartyId') || undefined,
    ownerScopePartyId:
      handoverType !== 'return' && form.watch('senderPartyKind') === 'other'
        ? form.watch('senderPartyScopePartyId') || undefined
        : undefined,
    ownerName:
      handoverType !== 'return' && form.watch('senderPartyKind') === 'other'
        ? form.watch('senderPartyName') || undefined
        : undefined,
    borrowerPartyId:
      handoverType === 'return'
        ? form.watch('senderPartyKind') === 'other'
          ? undefined
          : form.watch('senderPartyId') || undefined
        : undefined,
    borrowerScopePartyId:
      handoverType === 'return' && form.watch('senderPartyKind') === 'other'
        ? form.watch('senderPartyScopePartyId') || undefined
        : undefined,
    borrowerName:
      handoverType === 'return' && form.watch('senderPartyKind') === 'other'
        ? form.watch('senderPartyName') || undefined
        : undefined,
    status:
      handoverType === 'return' ? ('loaned' as const) : ('available' as const),
  };
  const materialOptions = useMemo(() => {
    const bulkMaterials = bulkMaterialsQuery.flatMap((result) =>
      result.data ? [result.data] : [],
    );
    const selectedMaterials = selectedMaterialsQuery.flatMap((result) =>
      result.data ? [result.data] : [],
    );
    const candidates = [...bulkMaterials, ...selectedMaterials];
    return candidates.filter(
      (material, index) =>
        candidates.findIndex((candidate) => candidate.id === material.id) ===
          index &&
        (!material.reservedHandoverId || material.reservedHandoverId === id),
    );
  }, [bulkMaterialsQuery, selectedMaterialsQuery, id]);
  const materialById = useMemo(
    () => new Map(materialOptions.map((material) => [material.id, material])),
    [materialOptions],
  );
  const representedSenderOptions = custodianList.filter(
    (party) => party.isActive && party.canRepresent && party.canManageHandover,
  );

  useEffect(() => {
    if (!document) return;
    const values = mapHandoverToFormValues(document);
    form.reset(values);
    lastSenderPartyIdRef.current = values.senderPartyId;
    senderSelectionInitializedRef.current = true;
  }, [document, form]);

  useEffect(() => {
    if (isEdit || !reverseSource) return;
    const source = mapHandoverToFormValues(reverseSource);
    const values = {
      ...source,
      type: reverseSource.type === 'loan' ? 'return' : 'transfer',
      senderPartyId:
        source.recipientPartyKind === 'other'
          ? ''
          : (reverseSource.recipientParty.id ?? ''),
      recipientPartyId:
        source.senderPartyKind === 'other'
          ? ''
          : (reverseSource.senderParty.id ?? ''),
      senderPartyKind: source.recipientPartyKind,
      recipientPartyKind: source.senderPartyKind,
      senderPartyCode: reverseSource.recipientParty.code,
      recipientPartyCode: reverseSource.senderParty.code,
      senderPartyName: reverseSource.recipientParty.name,
      recipientPartyName: reverseSource.senderParty.name,
      senderPartyPhone: reverseSource.recipientParty.phone ?? '',
      recipientPartyPhone: reverseSource.senderParty.phone ?? '',
      senderPartyEmail: reverseSource.recipientParty.email ?? '',
      recipientPartyEmail: reverseSource.senderParty.email ?? '',
      senderRepresentativeName:
        reverseSource.recipientRepresentative?.displayName ?? '',
      recipientRepresentativeName:
        reverseSource.senderRepresentative?.displayName ?? '',
      senderPartyScopePartyId:
        reverseSource.recipientParty.handoverScopePartyId ??
        reverseSource.recipientParty.scopePartyId ??
        '',
      recipientPartyScopePartyId:
        reverseSource.senderParty.handoverScopePartyId ??
        reverseSource.senderParty.scopePartyId ??
        '',
      senderRepresentativeUserId:
        reverseSource.recipientRepresentative?.userId ?? null,
      recipientRepresentativeUserId:
        reverseSource.senderRepresentative?.userId ?? null,
      plannedDate:
        reverseSource.plannedDate ?? new Date().toISOString().slice(0, 10),
      dueDate: '',
      note: '',
      items: reverseSource.items.map((item) => ({
        materialId: item.materialId,
        condition: item.senderCondition ?? item.condition,
        note: item.note ?? '',
      })),
      attachmentFileIds: [],
      expectedVersion: undefined,
      reverseFromHandoverId: reverseSource.id,
    };
    form.reset(values);
    lastSenderPartyIdRef.current = values.senderPartyId;
    senderSelectionInitializedRef.current = true;
  }, [form, isEdit, reverseSource]);

  useEffect(() => {
    const senderPartyId = form.getValues('senderPartyId');
    if (!senderSelectionInitializedRef.current) {
      lastSenderPartyIdRef.current = senderPartyId;
      senderSelectionInitializedRef.current = true;
      return;
    }
    if (
      lastSenderPartyIdRef.current &&
      lastSenderPartyIdRef.current !== senderPartyId
    ) {
      form.setValue('items', [], { shouldDirty: true, shouldValidate: true });
    }
    lastSenderPartyIdRef.current = senderPartyId;
  }, [form, selectedSenderPartyId]);

  useEffect(() => {
    if (
      isEdit ||
      reverseFromHandoverId ||
      !bulkMaterialIds.length ||
      processedBulkSenderPrefill.current ||
      bulkMaterialsQuery.length !== bulkMaterialIds.length ||
      bulkMaterialsQuery.some((result) => result.isPending || result.isError)
    ) {
      return;
    }

    const selectedBulkMaterials = bulkMaterialsQuery.flatMap((result) =>
      result.data ? [result.data] : [],
    );
    if (selectedBulkMaterials.length !== bulkMaterialIds.length) return;

    const material = selectedBulkMaterials[0];
    const owner = material.ownerSnapshot;
    const senderParty = (custodiansQuery.data ?? []).find(
      (party) => party.id === material.ownerPartyId,
    );
    if (owner.kind !== 'other' && custodiansQuery.isPending) return;

    const senderPartyId =
      owner.kind === 'other'
        ? ''
        : (material.ownerPartyId ??
          owner.partyId ??
          owner.catalogPartyId ??
          '');
    processedBulkSenderPrefill.current = true;
    lastSenderPartyIdRef.current = senderPartyId;
    senderSelectionInitializedRef.current = true;
    form.reset({
      ...form.getValues(),
      senderPartyId,
      senderPartyKind: owner.kind,
      senderPartyCode: owner.code || senderParty?.code || '',
      senderPartyName: owner.name || senderParty?.name || '',
      senderPartyPhone: owner.phone || senderParty?.phone || '',
      senderPartyEmail: owner.email || senderParty?.email || '',
      senderRepresentativeName:
        owner.representativeName ||
        senderParty?.representativeName ||
        senderParty?.representativeDisplayName ||
        '',
      senderPartyScopePartyId:
        owner.kind === 'other'
          ? (owner.scopePartyId ?? '')
          : (senderParty?.handoverScopePartyId ?? ''),
      senderRepresentativeUserId:
        owner.kind === 'other'
          ? null
          : (senderParty?.representativeUserId ?? null),
    });
  }, [
    bulkMaterialIds,
    bulkMaterialsQuery,
    custodiansQuery.data,
    custodiansQuery.isPending,
    form,
    isEdit,
    reverseFromHandoverId,
  ]);

  useEffect(() => {
    if (isEdit || !bulkMaterialIds.length) return;
    for (const [index, result] of bulkMaterialsQuery.entries()) {
      const requestedId = bulkMaterialIds[index];
      if (
        result.isError &&
        requestedId &&
        !processedBulkMaterialIds.current.has(requestedId)
      ) {
        processedBulkMaterialIds.current.add(requestedId);
        toast.error(getApiErrorMessage(result.error));
        continue;
      }
      const material = result.data;
      if (!material || processedBulkMaterialIds.current.has(material.id))
        continue;
      processedBulkMaterialIds.current.add(material.id);
      if (material.reservedHandoverId) {
        toast.error(
          intl.formatMessage({ id: 'project.materials.states.reserved' }),
        );
        continue;
      }
      const currentItems = form.getValues('items');
      if (currentItems.some((item) => item.materialId === material.id))
        continue;
      form.setValue(
        'items',
        [
          ...currentItems,
          {
            materialId: material.id,
            condition: material.condition,
            note: material.note ?? '',
          },
        ],
        { shouldDirty: true, shouldValidate: true },
      );
    }
  }, [bulkMaterialIds, bulkMaterialsQuery, form, intl, isEdit]);

  const onSave = useCallback(
    async (
      values: HandoverFormValues,
      sendAfterSave = false,
      continueAfterSave = false,
    ) => {
      let savedId: string | null = null;
      try {
        let attachmentFileIds = values.attachmentFileIds;
        if (pendingAttachmentFiles.length > 0) {
          if (!userId) {
            throw new Error(
              intl.formatMessage({
                id: 'project.handover.errors.missingUploader',
              }),
            );
          }
          setIsUploading(true);
          try {
            const fileIds = await uploadFilesToFolder(
              null,
              userId,
              pendingAttachmentFiles,
            );
            if (fileIds.length !== pendingAttachmentFiles.length) {
              throw new Error(
                intl.formatMessage({
                  id: 'project.handover.errors.uploadIncomplete',
                }),
              );
            }
            const uploaded = pendingAttachmentFiles.map((file, index) => ({
              fileId: fileIds[index],
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              sizeBytes: file.size,
            }));
            attachmentFileIds = [...attachmentFileIds, ...fileIds];
            form.setValue('attachmentFileIds', attachmentFileIds, {
              shouldDirty: true,
            });
            setUploadedAttachments((current) => [...current, ...uploaded]);
            setPendingAttachmentFiles([]);
          } finally {
            setIsUploading(false);
          }
        }
        const persistedId = await saveHandover({
          id: id || null,
          values: {
            ...values,
            attachmentFileIds,
            ...(isEdit ? { expectedVersion: document?.version } : {}),
          },
        });
        savedId = persistedId;
        if (sendAfterSave) {
          const latest: HandoverDocument =
            await import('../api/handovers.api').then((api) =>
              api.loadHandover(persistedId),
            );
          await actOnHandover({
            id: persistedId,
            action: 'send',
            expectedVersion: latest.version,
          });
          toast.success(
            intl.formatMessage({ id: 'project.handover.toasts.sent' }),
          );
        } else {
          toast.success(
            intl.formatMessage({ id: 'project.handover.toasts.saved' }),
          );
        }
        if (continueAfterSave) {
          setActiveStep(2);
          navigate(
            `${ROUTES.PROJECT.HANDOVER_DETAIL.replace(':id', persistedId)}?step=2`,
            { replace: true },
          );
        } else {
          navigate(ROUTES.PROJECT.HANDOVER_DETAIL.replace(':id', persistedId));
        }
      } catch (error) {
        if (sendAfterSave && savedId) {
          navigate(ROUTES.PROJECT.HANDOVER_DETAIL.replace(':id', savedId));
        }
        toast.error(getApiErrorMessage(error));
      }
    },
    [
      actOnHandover,
      document?.version,
      id,
      intl,
      isEdit,
      navigate,
      pendingAttachmentFiles,
      form,
      saveHandover,
      userId,
    ],
  );

  const header = useMemo(
    () => ({
      title: isEdit
        ? (document?.code ??
          intl.formatMessage({ id: 'project.handover.dialogs.editTitle' }))
        : intl.formatMessage({ id: 'project.handover.dialogs.createTitle' }),
      icon: FilePlus2,
      showBackButton: true,
      backLabel: intl.formatMessage({ id: 'project.handover.actions.back' }),
      onBack: () => navigate(ROUTES.PROJECT.HANDOVERS),
      actions:
        canManage &&
        activeStep === 1 &&
        (!isEdit ||
          (document?.status === 'draft' && document.mode === 'standard')) ? (
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={isSaving || isUploading}
            loadingText={intl.formatMessage({
              id: 'project.handover.labels.saving',
            })}
            onClick={() =>
              void form.handleSubmit((values) => onSave(values, false, true))()
            }
          >
            <Save />
            {intl.formatMessage({
              id: 'project.handover.actions.saveAndContinue',
            })}
          </Button>
        ) : null,
    }),
    [
      intl,
      isEdit,
      navigate,
      canManage,
      activeStep,
      document,
      isSaving,
      isUploading,
      form,
      onSave,
    ],
  );
  useDetailEntryLayoutHeader(
    header,
    !isEdit ||
      !document ||
      (document.status === 'draft' && document.mode === 'standard'),
  );

  const handleRemoveAttachment = (fileId: string) => {
    form.setValue(
      'attachmentFileIds',
      form.getValues('attachmentFileIds').filter((id) => id !== fileId),
      { shouldDirty: true },
    );
    setUploadedAttachments((current) =>
      current.filter((attachment) => attachment.fileId !== fileId),
    );
  };

  if (isPermissionsPending)
    return <div className="h-full animate-pulse bg-muted" />;
  if (!canManage && !isEdit)
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({
            id: 'project.handover.errors.noManagePermission',
          })}
          description={intl.formatMessage({
            id: 'project.handover.errors.contactAdmin',
          })}
        />
      </div>
    );
  if (isEdit && !canManage && !canView)
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({
            id: 'project.handover.errors.noViewPermission',
          })}
          description={intl.formatMessage({
            id: 'project.handover.errors.contactAdmin',
          })}
        />
      </div>
    );
  if (isEdit && documentQuery.isPending) {
    return (
      <div className="h-full p-4">
        <div className="h-full animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  if (isEdit && documentQuery.isError) {
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({
            id: 'project.handover.errors.loadDetailTitle',
          })}
          description={getApiErrorMessage(documentQuery.error)}
          onRetry={() => void documentQuery.refetch()}
        />
      </div>
    );
  }
  const attachmentFileIds = form.watch('attachmentFileIds');
  const attachmentsById = new Map(
    [...(document?.attachments ?? []), ...uploadedAttachments].map(
      (attachment) => [attachment.fileId, attachment],
    ),
  );
  const selectedAttachments = attachmentFileIds.flatMap((fileId) => {
    const attachment = attachmentsById.get(fileId);
    return attachment ? [attachment] : [];
  });
  const handoverTypeOptions = [
    {
      value: 'transfer',
      label: intl.formatMessage({ id: 'project.handover.type.transfer' }),
    },
    {
      value: 'loan',
      label: intl.formatMessage({ id: 'project.handover.type.loan' }),
    },
    {
      value: 'return',
      label: intl.formatMessage({ id: 'project.handover.type.return' }),
    },
  ] satisfies { value: HandoverType; label: string }[];
  const selectedHandoverType = form.watch('type') ?? 'transfer';
  const currentStatus = document
    ? intl.formatMessage({ id: `project.handover.status.${document.status}` })
    : intl.formatMessage({ id: 'project.handover.status.new' });
  const senderSignature = getSignatureInfo(document, historyEntries, 'sender');
  const recipientSignature = getSignatureInfo(
    document,
    historyEntries,
    'recipient',
  );

  const renderSignatureBadge = (state: HandoverSignatureState) => (
    <Badge
      variant={
        state === 'signed'
          ? 'success'
          : state === 'rejected'
            ? 'destructive'
            : 'secondary'
      }
      appearance="light"
      size="sm"
    >
      {intl.formatMessage({
        id:
          state === 'signed'
            ? 'project.handover.signature.signed'
            : state === 'rejected'
              ? 'project.handover.table.rejected'
              : 'project.handover.table.pending',
      })}
    </Badge>
  );

  const overviewCard = (
    <Card className="shrink-0 overflow-hidden">
      <div className="grid grid-cols-1 items-stretch gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_14rem_minmax(0,1fr)]">
        <HandoverPartyCard
          title={intl.formatMessage({
            id: 'project.handover.fields.sender',
          })}
          side="sender"
          form={form}
          parties={custodianList}
          readOnly={isReadOnly}
          statusBadge={
            isEdit ? renderSignatureBadge(senderSignature.state) : null
          }
          notice={
            representedSenderOptions.length === 0 ? (
              <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                {intl.formatMessage({
                  id: 'project.handover.errors.senderNotConfigured',
                })}
              </p>
            ) : null
          }
        />
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg py-2 text-center xl:py-0">
          <div className="grid w-full grid-cols-3 items-center text-primary">
            <div className="flex items-center justify-center">
              <ArrowRight className="size-6" aria-hidden="true" />
            </div>
            <div className="flex items-center justify-center">
              <Package className="size-10" aria-hidden="true" />
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="size-6" aria-hidden="true" />
            </div>
          </div>
          <div className="flex w-full min-w-0 max-w-64 flex-col items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {intl.formatMessage({
                id: 'project.handover.labels.transferFlow',
              })}
            </p>
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem variant="compact" className="w-full min-w-0 gap-0">
                  <FormLabel className="sr-only">
                    {intl.formatMessage({
                      id: 'project.handover.fields.type',
                    })}
                  </FormLabel>
                  <FormControl>
                    {isReadOnly ? (
                      <span className="text-sm font-semibold text-primary">
                        {
                          handoverTypeOptions.find(
                            (option) => option.value === field.value,
                          )?.label
                        }
                      </span>
                    ) : (
                      <OptionSelect
                        ariaLabel={intl.formatMessage({
                          id: 'project.handover.fields.type',
                        })}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        options={handoverTypeOptions}
                        searchable={false}
                        size="md"
                        variant="ghost"
                        className="mx-auto w-fit justify-center text-primary"
                        triggerContentClassName="text-center text-sm font-semibold"
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-xs text-muted-foreground">
              {intl.formatMessage({
                id: `project.handover.typeDescription.${selectedHandoverType}`,
              })}
            </p>
          </div>
        </div>
        <HandoverPartyCard
          title={intl.formatMessage({
            id: 'project.handover.fields.recipient',
          })}
          side="recipient"
          form={form}
          parties={recipientCatalogParties}
          readOnly={isReadOnly}
          statusBadge={
            isEdit ? renderSignatureBadge(recipientSignature.state) : null
          }
          notice={
            counterpartiesQuery.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.handover.errors.loadCounterpartiesTitle',
                })}
                description={getApiErrorMessage(counterpartiesQuery.error)}
                onRetry={() => void counterpartiesQuery.refetch()}
              />
            ) : null
          }
        />
      </div>

      <CardContent className="grid grid-cols-1 divide-y divide-border border-t border-border p-0 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:divide-y-0">
        <div className="flex min-w-0 items-center gap-3 px-4 py-3">
          <MetadataIcon>
            <CalendarDays className="size-5" aria-hidden="true" />
          </MetadataIcon>
          <FormField
            control={form.control}
            name="plannedDate"
            render={({ field }) => (
              <FormItem
                layout="horizontal"
                labelWidth="sm"
                variant="compact"
                className="min-w-0 flex-1"
              >
                <FormLabel variant="default">
                  {intl.formatMessage({
                    id: 'project.handover.fields.plannedDate',
                  })}
                </FormLabel>
                <FormControl>
                  <DatePickerInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    readOnly={isReadOnly}
                    valueMode="iso-date"
                    variant="md"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex min-w-0 items-center gap-3 px-4 py-3">
          <MetadataIcon>
            <CalendarDays
              className="size-5 text-violet-600"
              aria-hidden="true"
            />
          </MetadataIcon>
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem
                layout="horizontal"
                labelWidth="sm"
                variant="compact"
                className="min-w-0 flex-1"
              >
                <FormLabel variant="default">
                  {intl.formatMessage({
                    id: 'project.handover.fields.dueDate',
                  })}
                </FormLabel>
                <FormControl>
                  <DatePickerInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    readOnly={isReadOnly}
                    valueMode="iso-date"
                    variant="md"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex min-w-0 items-center gap-3 px-4 py-3 xl:min-w-48">
          <span
            className="size-3 shrink-0 rounded-full bg-emerald-500"
            aria-hidden="true"
          />
          <span className="text-sm leading-none font-normal text-foreground">
            {intl.formatMessage({
              id: 'project.handover.fields.status',
            })}
          </span>
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/50 dark:text-blue-100">
            {currentStatus}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 lg:p-5">
      <Form {...form}>
        {overviewCard}
        <Stepper
          value={activeStep}
          onValueChange={(step) => {
            const nextStep = step === 2 ? 2 : 1;
            setActiveStep(nextStep);
            setSearchParams(
              (current) => {
                const next = new URLSearchParams(current);
                next.set('step', String(nextStep));
                return next;
              },
              { replace: true },
            );
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
                  {intl.formatMessage({ id: 'project.handover.steps.items' })}
                </StepperTitle>
              </StepperTrigger>
              <StepperSeparator
                className={`mx-4 my-0 h-0 w-12 flex-none border-t border-dashed ${activeStep === 2 ? 'border-primary' : 'border-border'} bg-transparent`}
              />
            </StepperItem>
            <StepperItem step={2} fill={false}>
              <StepperTrigger>
                <StepperIndicator className="data-[state=inactive]:bg-border data-[state=active]:ring-2 data-[state=active]:ring-primary data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background">
                  2
                </StepperIndicator>
                <StepperTitle>
                  {intl.formatMessage({
                    id: 'project.handover.steps.confirmation',
                  })}
                </StepperTitle>
              </StepperTrigger>
            </StepperItem>
          </StepperNav>
          <StepperContent value={1} className="flex min-h-0 flex-1 flex-col">
            {custodiansQuery.isPending ||
            (Boolean(reverseFromHandoverId) && reverseSourceQuery.isPending) ? (
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
            ) : custodiansQuery.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.handover.errors.loadPartiesTitle',
                })}
                description={getApiErrorMessage(custodiansQuery.error)}
                onRetry={() => {
                  void custodiansQuery.refetch();
                }}
              />
            ) : reverseSourceQuery.isError ||
              (reverseFromHandoverId &&
                (!reverseSource ||
                  reverseSource.status !== 'completed' ||
                  !['transfer', 'loan'].includes(reverseSource.type))) ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.handover.errors.invalidReverseSourceTitle',
                })}
                description={intl.formatMessage({
                  id: 'project.handover.errors.invalidReverseSourceDescription',
                })}
                onRetry={() => void reverseSourceQuery.refetch()}
              />
            ) : (
              <form
                id="handover-form"
                onSubmit={form.handleSubmit((values) => void onSave(values))}
                className="flex h-full min-h-0 flex-1 flex-col gap-admin-page-section"
              >
                <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-admin-page-section xl:grid-cols-[minmax(0,2.2fr)_minmax(18rem,1fr)]">
                  <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
                    {hasSenderForItems ? (
                      <>
                        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                          <HandoverItemsEditorTable
                            form={form}
                            materials={[...materialById.values()]}
                            materialFilters={materialFilters}
                            initialMaterialSearch={initialMaterialSearch}
                            allowReservedByHandoverId={id || undefined}
                            readOnly={isReadOnly}
                            readOnlyItems={document?.items}
                            fillHeight
                          />
                        </div>
                        {form.formState.errors.items?.message ? (
                          <p
                            className="shrink-0 border-t border-border px-4 py-2 text-xs text-destructive"
                            role="alert"
                          >
                            {form.formState.errors.items.message}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                        {intl.formatMessage({
                          id: 'project.handover.empty.chooseSenderForItems',
                        })}
                      </div>
                    )}
                  </div>

                  <Card className="h-full min-h-0 min-w-0 overflow-y-auto">
                    <CardContent className="space-y-6 p-4">
                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <FileText
                            className="size-4 text-primary"
                            aria-hidden="true"
                          />
                          <h2 className="text-sm font-semibold">
                            {intl.formatMessage({
                              id: 'project.handover.fields.note',
                            })}
                          </h2>
                        </div>
                        <FormField
                          control={form.control}
                          name="note"
                          render={({ field }) => (
                            <FormItem variant="compact" className="min-w-0">
                              <FormLabel className="sr-only">
                                {intl.formatMessage({
                                  id: 'project.handover.fields.note',
                                })}
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  rows={4}
                                  {...field}
                                  readOnly={isReadOnly}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </section>
                      <HandoverAttachmentsField
                        attachments={selectedAttachments}
                        files={pendingAttachmentFiles}
                        onFilesChange={setPendingAttachmentFiles}
                        onRemove={handleRemoveAttachment}
                        disabled={
                          isReadOnly || isSaving || isActing || isUploading
                        }
                        isUploading={isUploading}
                      />
                    </CardContent>
                  </Card>
                </div>
              </form>
            )}
          </StepperContent>
          <StepperContent
            value={2}
            forceMount
            className="flex min-h-0 flex-1 flex-col"
          >
            <Card className="mx-auto w-full max-w-5xl">
              <CardHeader>
                <CardTitle>
                  {intl.formatMessage({
                    id: 'project.handover.steps.confirmation',
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  {intl.formatMessage({
                    id: 'project.handover.steps.confirmationDescription',
                  })}
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {(['sender', 'recipient'] as const).map((side) => {
                    const name =
                      side === 'sender'
                        ? form.watch('senderPartyName')
                        : form.watch('recipientPartyName');
                    const representative =
                      side === 'sender'
                        ? form.watch('senderRepresentativeName')
                        : form.watch('recipientRepresentativeName');
                    const signature =
                      side === 'sender' ? senderSignature : recipientSignature;
                    const isRejected = signature.state === 'rejected';
                    const signer = signature.entry?.actorDisplayName;
                    const rejectionReason = isRejected
                      ? signature.entry?.note?.trim()
                      : undefined;
                    return (
                      <div
                        key={side}
                        className="rounded-lg border border-border p-4"
                      >
                        <p className="text-sm font-medium">
                          {intl.formatMessage({
                            id: `project.handover.fields.${side}`,
                          })}
                        </p>
                        <p className="mt-2 text-sm">{name || '—'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {intl.formatMessage({
                            id: 'project.handover.fields.representative',
                          })}
                          : {representative || '—'}
                        </p>
                        <div className="mt-4 space-y-2 border-t border-dashed border-border pt-3 text-xs">
                          <p className="font-medium text-foreground">
                            {intl.formatMessage({
                              id:
                                signature.state === 'signed'
                                  ? 'project.handover.signature.signed'
                                  : isRejected
                                    ? 'project.handover.table.rejected'
                                    : 'project.handover.table.pending',
                            })}
                          </p>
                          {signature.entry ? (
                            <>
                              <p className="text-muted-foreground">
                                {intl.formatMessage({
                                  id: isRejected
                                    ? 'project.handover.signature.rejectedBy'
                                    : 'project.handover.signature.signer',
                                })}
                                : {signer || '—'}
                              </p>
                              <p className="text-muted-foreground">
                                {intl.formatMessage({
                                  id: isRejected
                                    ? 'project.handover.signature.rejectedAt'
                                    : 'project.handover.signature.signedAt',
                                })}
                                :{' '}
                                {formatSignatureTimestamp(
                                  signature.entry.createdAt,
                                  intl.locale,
                                )}
                              </p>
                              {isRejected ? (
                                <p className="text-muted-foreground">
                                  {intl.formatMessage({
                                    id: 'project.handover.signature.rejectionReason',
                                  })}
                                  : {rejectionReason || '—'}
                                </p>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                        {side === 'recipient' ? (
                          <div ref={approvalActionsTargetRef} />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {historyQuery.isError ? (
                  <ErrorState
                    title={intl.formatMessage({
                      id: 'project.handover.errors.loadHistoryTitle',
                    })}
                    description={getApiErrorMessage(historyQuery.error)}
                    onRetry={() => void historyQuery.refetch()}
                  />
                ) : null}
                {!isReadOnly ? (
                  <div className="flex justify-end pt-4">
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      disabled={isUploading || isSaving || isActing}
                      onClick={() =>
                        void form.handleSubmit((values) =>
                          onSave(values, true),
                        )()
                      }
                    >
                      <Send />
                      {intl.formatMessage({
                        id: 'project.handover.actions.send',
                      })}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </StepperContent>
        </Stepper>
      </Form>
      {isEdit &&
      document &&
      (document.status !== 'draft' || document.mode !== 'standard') ? (
        <HandoverDetailPage
          actionsOnly
          approvalActionsTargetRef={approvalActionsTargetRef}
        />
      ) : null}
    </div>
  );
}
