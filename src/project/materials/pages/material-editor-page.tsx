import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import { MATERIAL_MODEL_IMAGES_BUCKET } from '@/project/material-models/api/material-models.api';
import { MaterialModelGalleryCard } from '@/project/material-models/forms/material-model-gallery-card';
import { useMaterialModelsQuery } from '@/project/material-models/hooks/use-material-models';
import { MaterialSpecificationsTable } from '@/project/material-models/table/material-specifications-table';
import { Boxes, Save } from 'lucide-react';
import type { SubmitErrorHandler } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/loading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { MATERIAL_IMAGES_BUCKET } from '../api/materials.api';
import {
  materialDefaultValues,
  MaterialForm,
  useMaterialForm,
} from '../forms/material-form.generated';
import type { MaterialFormSchemaValues } from '../forms/material-form.schema';
import {
  useMaterialQuery,
  useSaveMaterialMutation,
} from '../hooks/use-materials';
import type {
  Material,
  MaterialCondition,
  MaterialFormValues,
  MaterialImageDraft,
} from '../model/material';
import { MATERIAL_PERMISSION_CODES } from '../model/material-permissions';

const FORM_ID = 'material-editor-form';

export function MaterialEditorPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const isEdit = Boolean(id);
  const { userId, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const form = useMaterialForm();
  const [galleryImages, setGalleryImages] = useState<MaterialImageDraft[]>([]);
  const [activeTab, setActiveTab] = useState('general');
  const materialQuery = useMaterialQuery(
    id,
    !isPermissionsPending && isEdit && canView,
  );
  const modelsQuery = useMaterialModelsQuery(
    !isPermissionsPending && (canManage || canView),
  );
  const custodiansQuery = useCustodiansQuery(
    false,
    !isPermissionsPending && canManage && !isEdit,
  );
  const saveMutation = useSaveMaterialMutation();
  const editingMaterial = materialQuery.data;
  const selectedModelId = form.watch('modelId');
  const previousModelId = useRef('');
  const hydratedModelId = useRef('');
  const currentModel = modelsQuery.data?.find(
    (model) =>
      model.id === (isEdit ? editingMaterial?.modelId : selectedModelId),
  );
  const snapshot = isEdit ? editingMaterial?.modelSnapshot : currentModel;

  useEffect(() => {
    if (isEdit && editingMaterial) {
      form.reset(mapMaterialToForm(editingMaterial));
      setGalleryImages(editingMaterial.images);
      previousModelId.current = editingMaterial.modelId;
    } else if (!isEdit) {
      form.reset(materialDefaultValues);
      setGalleryImages([]);
      previousModelId.current = '';
      hydratedModelId.current = '';
    }
  }, [editingMaterial, form, isEdit]);

  useEffect(() => {
    if (isEdit || !selectedModelId || !currentModel) return;

    const selectionChanged = previousModelId.current !== selectedModelId;
    const shouldHydrateModelValues =
      hydratedModelId.current !== selectedModelId;
    if (!selectionChanged && !shouldHydrateModelValues) return;
    const previousModel = modelsQuery.data?.find(
      (model) => model.id === previousModelId.current,
    );

    if (selectionChanged) {
      form.setValue('specificationOverrides', {}, { shouldDirty: true });
      form.setValue('specificationOverrideLabels', {}, { shouldDirty: true });

      const inheritedImages = (currentModel.images ?? []).map((image) => ({
        ...image,
        storageBucket: MATERIAL_MODEL_IMAGES_BUCKET,
      }));
      const uploadedImages = galleryImages.filter(
        (image) => image.storageBucket === MATERIAL_IMAGES_BUCKET,
      );
      const uploadedImageHasCover = uploadedImages.some(
        (image) => image.isCover,
      );
      setGalleryImages([
        ...inheritedImages.map((image) => ({
          ...image,
          isCover: uploadedImageHasCover ? false : image.isCover,
        })),
        ...uploadedImages,
      ]);
    }

    if (shouldHydrateModelValues) {
      const currentName = form.getValues('nameOverride');
      if (!currentName || currentName === previousModel?.name) {
        form.setValue('nameOverride', currentModel.name, {
          shouldDirty: true,
        });
      }
      const currentDescription = form.getValues('descriptionOverride');
      if (
        !currentDescription ||
        currentDescription === previousModel?.description
      ) {
        form.setValue('descriptionOverride', currentModel.description, {
          shouldDirty: true,
        });
      }
      hydratedModelId.current = selectedModelId;
    }
    previousModelId.current = selectedModelId;
  }, [
    currentModel,
    form,
    galleryImages,
    isEdit,
    modelsQuery.data,
    selectedModelId,
  ]);

  const availableModels = useMemo(
    () =>
      (modelsQuery.data ?? []).filter(
        (model) => model.isActive || model.id === editingMaterial?.modelId,
      ),
    [editingMaterial?.modelId, modelsQuery.data],
  );
  const ownerPartyIdOptions = useMemo(
    () =>
      (custodiansQuery.data ?? [])
        .filter(
          (party) =>
            party.isActive &&
            (party.accountUserId === userId ||
              party.representativeUserId === userId),
        )
        .map((party) => ({
          value: party.id,
          label: `${party.name} · ${party.code}`,
        })),
    [custodiansQuery.data, userId],
  );
  const isLoading =
    isPermissionsPending ||
    (isEdit && canView && materialQuery.isPending) ||
    (!isEdit &&
      canManage &&
      (modelsQuery.isPending || custodiansQuery.isPending));
  const isSaving = saveMutation.isPending;
  const title = intl.formatMessage({
    id: isEdit
      ? 'project.materials.page.editTitle'
      : 'project.materials.page.createTitle',
  });
  const back = useCallback(
    () => navigate(ROUTES.PROJECT.MATERIALS),
    [navigate],
  );

  const header = useMemo(
    () => ({
      title,
      icon: Boxes,
      showBackButton: true,
      backLabel: intl.formatMessage({ id: 'project.materials.actions.back' }),
      onBack: back,
      actions:
        canManage && !isLoading && (!isEdit || editingMaterial) ? (
          <Button
            type="submit"
            form={FORM_ID}
            variant="primary"
            size="md"
            loading={isSaving}
            disabled={
              (!isEdit && ownerPartyIdOptions.length === 0) ||
              Boolean(editingMaterial?.reservedHandoverId)
            }
            loadingText={intl.formatMessage({
              id: 'project.materials.actions.saving',
            })}
          >
            <Save />
            {intl.formatMessage({ id: 'project.materials.actions.save' })}
          </Button>
        ) : null,
    }),
    [
      back,
      canManage,
      editingMaterial,
      intl,
      isEdit,
      isLoading,
      isSaving,
      ownerPartyIdOptions.length,
      title,
    ],
  );
  useDetailEntryLayoutHeader(header);

  const handleSubmit = (values: MaterialFormSchemaValues) => {
    if (!canManage || (isEdit && !editingMaterial)) return;
    if (
      galleryImages.length > 0 &&
      !galleryImages.some((image) => image.isCover)
    ) {
      toast.error(
        intl.formatMessage({ id: 'project.materials.gallery.coverRequired' }),
      );
      return;
    }
    const selectedModel = modelsQuery.data?.find(
      (model) => model.id === values.modelId,
    );
    const payload: MaterialFormValues = {
      ...values,
      nameOverride:
        values.nameOverride.trim() === selectedModel?.name.trim()
          ? ''
          : values.nameOverride,
      descriptionOverride:
        values.descriptionOverride.trim() === selectedModel?.description.trim()
          ? ''
          : values.descriptionOverride,
      condition: values.condition as MaterialCondition,
    };
    saveMutation.mutate(
      {
        id: isEdit ? id : null,
        expectedVersion: isEdit ? editingMaterial!.version : null,
        values: payload,
        images: galleryImages,
        previousImages: editingMaterial?.images ?? [],
      },
      {
        onSuccess: (savedId) => {
          toast.success(
            intl.formatMessage({
              id: isEdit
                ? 'project.materials.toasts.updated'
                : 'project.materials.toasts.created',
            }),
          );
          navigate(
            buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, {
              id: isEdit ? id : savedId,
            }),
          );
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  const handleInvalidSubmit: SubmitErrorHandler<MaterialFormSchemaValues> = (
    errors,
  ) => {
    setActiveTab(errors.specificationOverrides ? 'technical' : 'general');
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-hidden p-4 lg:p-5">
      {!isPermissionsPending && (!canManage || (isEdit && !canView)) ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.errors.authorizationTitle',
          })}
          description={intl.formatMessage({
            id: 'project.materials.errors.authorization',
          })}
        />
      ) : isLoading ? (
        <PageLoading
          label={intl.formatMessage({ id: 'common.state.loading' })}
        />
      ) : materialQuery.isError ||
        (!isEdit && (modelsQuery.isError || custodiansQuery.isError)) ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.errors.loadDetailTitle',
          })}
          description={getApiErrorMessage(
            materialQuery.error ?? modelsQuery.error ?? custodiansQuery.error,
          )}
          onRetry={() => {
            if (isEdit) void materialQuery.refetch();
            else {
              void modelsQuery.refetch();
              void custodiansQuery.refetch();
            }
          }}
        />
      ) : isEdit && !editingMaterial ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.errors.notFoundTitle',
          })}
          description={intl.formatMessage({
            id: 'project.materials.errors.notFound',
          })}
        />
      ) : (
        <form
          id={FORM_ID}
          onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)}
          className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto xl:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] xl:overflow-hidden"
        >
          <MaterialModelGalleryCard
            key={id ?? 'create'}
            images={galleryImages}
            messagePrefix="project.materials.gallery"
            onImagesChange={(images) =>
              setGalleryImages(
                images.map((image) =>
                  image.file
                    ? { ...image, storageBucket: MATERIAL_IMAGES_BUCKET }
                    : image,
                ),
              )
            }
          />
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-[32rem] min-w-0 flex-1 flex-col xl:overflow-hidden"
          >
            <TabsList variant="line" size="md" className="w-full">
              <TabsTrigger value="general">
                {intl.formatMessage({ id: 'project.materials.tabs.general' })}
              </TabsTrigger>
              <TabsTrigger
                value="technical"
                count={snapshot?.specifications.length ?? 0}
              >
                {intl.formatMessage({
                  id: 'project.materials.tabs.specifications',
                })}
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="general"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <Card className="min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-5">
                  {isEdit ? (
                    <div className="mb-5 grid grid-cols-1 gap-3">
                      <div className="grid gap-2 sm:grid-cols-[minmax(160px,0.7fr)_minmax(0,1.3fr)] sm:items-center">
                        <span className="text-sm font-medium">
                          {intl.formatMessage({
                            id: 'project.materials.fields.code',
                          })}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {editingMaterial?.code}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[minmax(160px,0.7fr)_minmax(0,1.3fr)] sm:items-center">
                        <span className="text-sm font-medium">
                          {intl.formatMessage({
                            id: 'project.materials.fields.model',
                          })}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {editingMaterial?.modelSnapshot.name}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <MaterialForm
                    id={FORM_ID}
                    mode={isEdit ? 'edit' : 'create'}
                    form={form}
                    onSubmit={handleSubmit}
                    models={availableModels}
                    ownerPartyIdOptions={ownerPartyIdOptions}
                    renderFormElement={false}
                  />
                  {!isEdit && ownerPartyIdOptions.length === 0 ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-admin-control border border-warning/40 bg-warning/5 p-4">
                      <p className="text-sm">
                        {intl.formatMessage({
                          id: 'project.materials.form.noRepresentedOwner',
                        })}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          navigate(ROUTES.PROJECT.EPS_ORGANIZATIONS)
                        }
                      >
                        {intl.formatMessage({
                          id: 'project.materials.actions.manageCustodians',
                        })}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent
              value="technical"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <Card className="min-h-[32rem] min-w-0 flex-1 flex-col overflow-hidden">
                {snapshot ? (
                  <MaterialSpecificationsTable
                    mode="material"
                    specifications={snapshot.specifications}
                    values={form.watch('specificationOverrides') ?? {}}
                    valueLabels={
                      form.watch('specificationOverrideLabels') ?? {}
                    }
                    onChange={(next) =>
                      form.setValue('specificationOverrides', next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    onValueLabelsChange={(next) =>
                      form.setValue('specificationOverrideLabels', next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                ) : (
                  <MaterialSpecificationsTable
                    mode="material"
                    specifications={null}
                    values={form.watch('specificationOverrides') ?? {}}
                    valueLabels={
                      form.watch('specificationOverrideLabels') ?? {}
                    }
                    onChange={(next) =>
                      form.setValue('specificationOverrides', next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    onValueLabelsChange={(next) =>
                      form.setValue('specificationOverrideLabels', next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      )}
    </div>
  );
}

function mapMaterialToForm(material: Material): MaterialFormSchemaValues {
  return {
    code: material.code,
    modelId: material.modelId,
    nameOverride: material.nameOverride ?? '',
    descriptionOverride: material.descriptionOverride ?? '',
    serialNumber: material.serialNumber ?? '',
    ownerPartyId: material.ownerPartyId,
    condition: material.condition,
    note: material.note ?? '',
    specificationOverrides: { ...material.specificationOverrides },
    specificationOverrideLabels: {
      ...material.specificationOverrideLabels,
    },
  };
}
