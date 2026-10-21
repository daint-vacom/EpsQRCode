import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import { uploadFilesToFolder } from '@/project/files/api/file-manager.api';
import { HandoverAttachmentsField } from '@/project/handover/components/handover-attachments-field';
import { HandoverItemsEditorTable } from '@/project/handover/table/handover-items-editor-table.generated';
import { useMaterialsByIdsQuery } from '@/project/materials/hooks/use-materials';
import type { MaterialListFilters } from '@/project/materials/model/material';
import { FilePlus2, Save, Send } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import {
  HandoverForm,
  mapHandoverToFormValues,
  useHandoverForm,
} from '../forms/handover-form.generated';
import {
  useHandoverActionMutation,
  useHandoverQuery,
  useSaveHandoverMutation,
} from '../hooks/use-handovers';
import type { HandoverAttachment, HandoverDocument } from '../model/handover';
import type { HandoverFormValues } from '../model/handover-form-schema';
import { HANDOVER_PERMISSION_CODES } from '../model/handover-permissions';

function isUuid(value: string) {
  return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
    value,
  );
}

export function HandoverEditorPage() {
  const intl = useIntl();
  const location = useLocation();
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { userId, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canManage = hasPermission(HANDOVER_PERMISSION_CODES.manage);
  const documentQuery = useHandoverQuery(id, isEdit && canManage);
  const custodiansQuery = useCustodiansQuery(false, canManage);
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
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState<File[]>(
    [],
  );
  const [uploadedAttachments, setUploadedAttachments] = useState<
    HandoverAttachment[]
  >([]);
  const form = useHandoverForm();
  const selectedMaterialIds = (form.watch('items') ?? [])
    .map((item) => item.materialId)
    .filter(isUuid);
  const selectedMaterialsQuery = useMaterialsByIdsQuery(
    [...new Set(selectedMaterialIds)],
    canManage,
  );
  const document = documentQuery.data;
  const custodianList = (custodiansQuery.data ?? []).filter(
    (party) => party.type !== 'warehouse',
  );
  const sender = custodianList.find(
    (party) => party.id === form.watch('senderPartyId'),
  );
  const recipient = custodianList.find(
    (party) => party.id === form.watch('recipientPartyId'),
  );
  const handoverType = form.watch('type');
  const materialFilters: Omit<
    MaterialListFilters,
    'search' | 'page' | 'pageSize'
  > = {
    ownerPartyId:
      handoverType === 'return'
        ? undefined
        : form.watch('senderPartyId') || undefined,
    borrowerPartyId:
      handoverType === 'return'
        ? form.watch('senderPartyId') || undefined
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
  const representativeOptions = (partyId: string) => {
    const party = custodianList.find((item) => item.id === partyId);
    return party?.representativeUserId
      ? [
          {
            value: party.representativeUserId,
            label: party.representativeDisplayName || party.name,
          },
        ]
      : [];
  };
  const representedSenderOptions = custodianList
    .filter(
      (party) =>
        party.isActive &&
        userId &&
        (party.accountUserId === userId ||
          party.accountUserIds.includes(userId) ||
          party.representativeUserId === userId),
    )
    .map((party) => ({
      value: party.id,
      label: `${party.name} · ${party.code}`,
    }));
  const activePartyOptions = custodianList
    .filter((party) => party.isActive)
    .map((party) => ({
      value: party.id,
      label: `${party.name} · ${party.code}`,
    }));

  useEffect(() => {
    if (!document) return;
    form.reset(mapHandoverToFormValues(document));
  }, [document, form]);

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
    async (values: HandoverFormValues, sendAfterSave = false) => {
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
        navigate(ROUTES.PROJECT.HANDOVER_DETAIL.replace(':id', persistedId));
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
      title: intl.formatMessage({
        id: isEdit
          ? 'project.handover.dialogs.editTitle'
          : 'project.handover.dialogs.createTitle',
      }),
      icon: FilePlus2,
      showBackButton: true,
      backLabel: intl.formatMessage({ id: 'project.handover.actions.back' }),
      onBack: () => navigate(ROUTES.PROJECT.HANDOVERS),
      actions:
        canManage && (!isEdit || document?.status === 'draft') ? (
          <>
            <Button
              type="submit"
              form="handover-form"
              variant="secondary"
              size="md"
              loading={isSaving || isUploading}
              loadingText={intl.formatMessage({
                id: 'project.handover.labels.saving',
              })}
            >
              <Save />
              {intl.formatMessage({ id: 'project.handover.actions.saveDraft' })}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={isUploading || isSaving || isActing}
              onClick={() =>
                void form.handleSubmit((values) => onSave(values, true))()
              }
            >
              <Send />
              {intl.formatMessage({ id: 'project.handover.actions.send' })}
            </Button>
          </>
        ) : null,
    }),
    [
      intl,
      isEdit,
      navigate,
      canManage,
      document,
      isSaving,
      isUploading,
      isActing,
      form,
      onSave,
    ],
  );
  useDetailEntryLayoutHeader(header);

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
  if (!canManage)
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
  if (isEdit && document && document.status !== 'draft') {
    return (
      <div className="p-4">
        <ErrorState
          title="Phiếu đã được khóa"
          description={intl.formatMessage({
            id: 'project.handover.errors.draftOnly',
          })}
          onRetry={() =>
            navigate(ROUTES.PROJECT.HANDOVER_DETAIL.replace(':id', id))
          }
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
  const formView = (
    <div className="xl:h-full xl:min-h-0">
      <HandoverForm
        form={form}
        onSubmit={(values) => void onSave(values)}
        editorLayout
        senderPartyIdOptions={representedSenderOptions}
        recipientPartyIdOptions={activePartyOptions}
        senderRepresentativeUserIdOptions={representativeOptions(
          sender?.id ?? '',
        )}
        recipientRepresentativeUserIdOptions={representativeOptions(
          recipient?.id ?? '',
        )}
        sideContent={
          <div className="mt-5 space-y-5 border-t border-border pt-5">
            {representedSenderOptions.length === 0 ? (
              <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                Tài khoản của bạn chưa được gắn với chủ thể bên giao. Hãy cấu
                hình người đại diện trong danh mục chủ thể trước khi lập phiếu.
              </p>
            ) : null}
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem layout="horizontal" labelWidth="md" alignment="start">
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'project.handover.fields.note',
                    })}
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <HandoverAttachmentsField
              attachments={selectedAttachments}
              files={pendingAttachmentFiles}
              onFilesChange={setPendingAttachmentFiles}
              onRemove={handleRemoveAttachment}
              disabled={isSaving || isActing || isUploading}
              isUploading={isUploading}
            />
          </div>
        }
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <HandoverItemsEditorTable
              form={form}
              materials={[...materialById.values()]}
              materialFilters={materialFilters}
              initialMaterialSearch={initialMaterialSearch}
              allowReservedByHandoverId={id || undefined}
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
        </div>
      </HandoverForm>
    </div>
  );

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 lg:p-5 xl:overflow-hidden">
      {custodiansQuery.isPending ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : custodiansQuery.isError ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.handover.errors.loadPartiesTitle',
          })}
          description={getApiErrorMessage(custodiansQuery.error)}
          onRetry={() => void custodiansQuery.refetch()}
        />
      ) : (
        formView
      )}
    </div>
  );
}
