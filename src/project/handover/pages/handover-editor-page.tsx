import { useCallback, useEffect, useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import { uploadFilesToFolder } from '@/project/files/api/file-manager.api';
import {
  useMaterialQuery,
  useMaterialsQuery,
} from '@/project/materials/hooks/use-materials';
import type { Material } from '@/project/materials/model/material';
import { FilePlus2, Plus, Save, Send, Trash2 } from 'lucide-react';
import { useFieldArray } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
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
import type { HandoverDocument } from '../model/handover';
import type { HandoverFormValues } from '../model/handover-form-schema';
import { HANDOVER_PERMISSION_CODES } from '../model/handover-permissions';

function normalizeMaterialSearch(value: string) {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const materialIndex = segments.findIndex(
      (segment) => segment === 'materials',
    );
    if (materialIndex >= 0 && segments[materialIndex + 1])
      return segments[materialIndex + 1];
  } catch {
    // Treat non-URLs as material code/name searches.
  }
  return value.trim();
}

function isUuid(value: string) {
  return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
    value,
  );
}

export function HandoverEditorPage() {
  const intl = useIntl();
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
  const [materialSearch, setMaterialSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const form = useHandoverForm();
  const items = useFieldArray({ control: form.control, name: 'items' });
  const document = documentQuery.data;
  const custodianList = custodiansQuery.data ?? [];
  const sender = custodianList.find(
    (party) => party.id === form.watch('senderPartyId'),
  );
  const recipient = custodianList.find(
    (party) => party.id === form.watch('recipientPartyId'),
  );
  const handoverType = form.watch('type');
  const normalizedSearch = normalizeMaterialSearch(materialSearch);
  const searchLooksLikeId = isUuid(normalizedSearch);
  const byIdQuery = useMaterialQuery(
    normalizedSearch,
    canManage && searchLooksLikeId,
  );
  const materialFilters = {
    search: normalizedSearch || undefined,
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
    page: 1,
    pageSize: 50,
  };
  const materialsQuery = useMaterialsQuery(
    materialFilters,
    canManage &&
      normalizedSearch.length >= 2 &&
      Boolean(form.watch('senderPartyId')),
  );
  const materialOptions = useMemo(() => {
    const byIdMaterial = byIdQuery.data;
    const list = materialsQuery.data?.items ?? [];
    const candidates = byIdMaterial ? [byIdMaterial, ...list] : list;
    return candidates.filter(
      (material, index) =>
        candidates.findIndex((candidate) => candidate.id === material.id) ===
          index &&
        (!material.reservedHandoverId || material.reservedHandoverId === id),
    );
  }, [byIdQuery.data, materialsQuery.data?.items, id]);
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

  const addMaterial = (material: Material) => {
    if (items.fields.some((item) => item.materialId === material.id)) {
      toast.error(
        intl.formatMessage({ id: 'project.handover.errors.duplicateMaterial' }),
      );
      return;
    }
    items.append({
      materialId: material.id,
      condition: material.condition,
      conditionNote: material.conditionNote ?? '',
    });
    setMaterialSearch('');
  };

  const onSave = useCallback(
    async (values: HandoverFormValues, sendAfterSave = false) => {
      let savedId: string | null = null;
      try {
        const persistedId = await saveHandover({
          id: id || null,
          values: {
            ...values,
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
      saveHandover,
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

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !userId) return;
    setIsUploading(true);
    try {
      const upload = await uploadFilesToFolder(null, userId, Array.from(files));
      const fileIds = upload;
      if (!fileIds.length)
        throw new Error('Không nhận được mã tệp đã tải lên.');
      form.setValue(
        'attachmentFileIds',
        [...form.getValues('attachmentFileIds'), ...fileIds],
        { shouldDirty: true },
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
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
  const formView = (
    <HandoverForm
      form={form}
      onSubmit={(values) => void onSave(values)}
      senderPartyIdOptions={representedSenderOptions}
      recipientPartyIdOptions={activePartyOptions}
      senderRepresentativeUserIdOptions={representativeOptions(
        sender?.id ?? '',
      )}
      recipientRepresentativeUserIdOptions={representativeOptions(
        recipient?.id ?? '',
      )}
    >
      <div className="mt-6 space-y-5">
        {representedSenderOptions.length === 0 ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            Tài khoản của bạn chưa được gắn với chủ thể bên giao. Hãy cấu hình
            người đại diện trong danh mục chủ thể trước khi lập phiếu.
          </p>
        ) : null}
        <FormField
          control={form.control}
          name="items"
          render={({ fieldState }) => (
            <FormItem layout="horizontal" labelWidth="md" alignment="start">
              <FormLabel>
                {intl.formatMessage({ id: 'project.handover.fields.material' })}
                <span className="text-destructive"> *</span>
              </FormLabel>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Input
                    aria-label={intl.formatMessage({
                      id: 'project.handover.labels.materialSearch',
                    })}
                    value={materialSearch}
                    onChange={(event) => setMaterialSearch(event.target.value)}
                    className="min-w-64 flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!materialOptions.length}
                    onClick={() => addMaterial(materialOptions[0])}
                  >
                    <Plus />
                    {intl.formatMessage({
                      id: 'project.handover.actions.addItem',
                    })}
                  </Button>
                </div>
                {normalizedSearch.length >= 2 && materialOptions.length ? (
                  <div className="max-h-48 overflow-auto rounded-lg border border-border">
                    {materialOptions.map((material) => (
                      <button
                        key={material.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted/60"
                        onClick={() => addMaterial(material)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {material.code} ·{' '}
                            {material.nameOverride ||
                              material.modelSnapshot.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {material.modelSnapshot.code}
                            {material.serialNumber
                              ? ` · ${material.serialNumber}`
                              : ''}
                          </span>
                        </span>
                        <Plus className="size-4 shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : normalizedSearch.length >= 2 ? (
                  <p className="text-sm text-muted-foreground">
                    Không có vật tư phù hợp với bên giao hoặc vật tư đang được
                    giữ trên phiếu khác.
                  </p>
                ) : null}
                {items.fields.length ? (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Vật tư</th>
                          <th className="w-40 px-3 py-2">Tình trạng</th>
                          <th className="px-3 py-2">Ghi chú tình trạng</th>
                          <th className="w-12 px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.fields.map((item, index) => {
                          const material = materialOptions.find(
                            (option) => option.id === item.materialId,
                          );
                          const errorMessage =
                            form.formState.errors.items?.[index]?.conditionNote
                              ?.message;
                          return (
                            <tr
                              key={item.id}
                              className="border-t border-border align-top"
                            >
                              <td className="px-3 py-2">
                                <span className="font-medium">
                                  {material?.code ?? item.materialId}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {material?.nameOverride ||
                                    material?.modelSnapshot.name}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <OptionSelect
                                  value={form.watch(`items.${index}.condition`)}
                                  onChange={(value) =>
                                    form.setValue(
                                      `items.${index}.condition`,
                                      value as 'good' | 'damaged',
                                      {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      },
                                    )
                                  }
                                  options={[
                                    { value: 'good', label: 'Tốt' },
                                    { value: 'damaged', label: 'Hỏng' },
                                  ]}
                                  searchable={false}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <Textarea
                                  rows={1}
                                  value={form.watch(
                                    `items.${index}.conditionNote`,
                                  )}
                                  onChange={(event) =>
                                    form.setValue(
                                      `items.${index}.conditionNote`,
                                      event.target.value,
                                      {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      },
                                    )
                                  }
                                  aria-label={`Ghi chú tình trạng ${index + 1}`}
                                />
                                {errorMessage ? (
                                  <p className="mt-1 text-xs text-destructive">
                                    {String(errorMessage)}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-2 py-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={intl.formatMessage({
                                    id: 'project.handover.labels.removeMaterial',
                                  })}
                                  onClick={() => items.remove(index)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Chưa thêm vật tư.
                  </p>
                )}
                {fieldState.error?.message ? (
                  <p className="text-xs text-destructive">
                    {fieldState.error.message}
                  </p>
                ) : null}
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="attachmentFileIds"
          render={() => (
            <FormItem layout="horizontal" labelWidth="md" alignment="start">
              <FormLabel>
                {intl.formatMessage({
                  id: 'project.handover.fields.attachments',
                })}
              </FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Input
                    type="file"
                    multiple
                    aria-label={intl.formatMessage({
                      id: 'project.handover.fields.attachments',
                    })}
                    disabled={isUploading}
                    onChange={(event) => {
                      void handleUpload(event.target.files);
                      event.currentTarget.value = '';
                    }}
                  />
                  {isUploading ? (
                    <p className="text-xs text-muted-foreground">
                      Đang tải tệp lên
                    </p>
                  ) : attachmentFileIds.length ? (
                    <p className="text-xs text-muted-foreground">
                      Đã đính kèm {attachmentFileIds.length} tệp.
                    </p>
                  ) : null}
                </div>
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </HandoverForm>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 lg:p-5">
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
        <Card className="w-full">
          <CardHeader>
            <CardTitle>
              {intl.formatMessage({
                id: isEdit
                  ? 'project.handover.dialogs.editTitle'
                  : 'project.handover.dialogs.createTitle',
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>{formView}</CardContent>
        </Card>
      )}
    </div>
  );
}
