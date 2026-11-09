import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import { useMaterialGroupQuery } from '@/project/material-groups/hooks/use-material-groups';
import { MATERIAL_MODEL_IMAGES_BUCKET } from '@/project/material-models/api/material-models.api';
import { MaterialModelGalleryCard } from '@/project/material-models/forms/material-model-gallery-card';
import { useMaterialModelsQuery } from '@/project/material-models/hooks/use-material-models';
import {
  DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
  mapPublicSpecificationSettings,
} from '@/project/material-models/model/material-model';
import type { MaterialPublicDisplaySettings } from '@/project/material-models/model/material-model';
import { MaterialSpecificationsTable } from '@/project/material-models/table/material-specifications-table';
import { SafetyInspectionChecklistDisplay } from '@/project/material-safety-inspections/components/safety-inspection-checklist-display';
import { SafetyInspectionChecklistEditor } from '@/project/material-safety-inspections/components/safety-inspection-checklist-editor';
import { mergeSafetyInspectionChecklists } from '@/project/material-safety-inspections/model/safety-inspection-checklist';
import {
  Boxes,
  ClipboardCheck,
  Eye,
  Info,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import type { SubmitErrorHandler } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorState } from '@/components/ui/error-state';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/ui/loading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { MATERIAL_IMAGES_BUCKET } from '../api/materials.api';
import { MaterialOwnerCard } from '../components/material-owner-card';
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
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const form = useMaterialForm();
  const [galleryImages, setGalleryImages] = useState<MaterialImageDraft[]>([]);
  const [publicDisplaySettings, setPublicDisplaySettings] =
    useState<MaterialPublicDisplaySettings>(
      DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
    );
  const [publicSpecificationSettings, setPublicSpecificationSettings] =
    useState<Record<string, boolean>>({});
  const [hiddenSpecificationIds, setHiddenSpecificationIds] = useState<
    string[]
  >([]);
  const [activeTab, setActiveTab] = useState('general');
  const materialQuery = useMaterialQuery(
    id,
    !isPermissionsPending && isEdit && canView,
  );
  const modelsQuery = useMaterialModelsQuery(
    !isPermissionsPending && (canManage || canView),
  );
  const custodiansQuery = useCustodiansQuery(
    true,
    !isPermissionsPending && (canManage || (isEdit && canView)),
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
  const groupQuery = useMaterialGroupQuery(
    currentModel?.groupId ?? '',
    !isPermissionsPending && Boolean(currentModel),
  );
  const snapshot = isEdit ? editingMaterial?.modelSnapshot : currentModel;
  const inspectionChecklist = form.watch('safetyInspectionChecklist') ?? [];
  const inheritedInspectionChecklist =
    isEdit && editingMaterial?.modelSnapshot.safetyInspectionChecklist
      ? mergeSafetyInspectionChecklists(
          editingMaterial.modelSnapshot.safetyInspectionChecklist,
        )
      : mergeSafetyInspectionChecklists(
          currentModel?.useGroupSafetyInspectionChecklist
            ? groupQuery.data?.safetyInspectionChecklist
            : undefined,
          currentModel?.safetyInspectionChecklist,
        );
  const requiresSafetyInspection = snapshot?.requiresInspection ?? false;
  const snapshotSpecifications =
    snapshot?.specifications.filter(
      (specification) => !hiddenSpecificationIds.includes(specification.id),
    ) ?? null;

  useEffect(() => {
    if (isEdit && editingMaterial) {
      form.reset(mapMaterialToForm(editingMaterial));
      setGalleryImages(editingMaterial.images);
      setPublicDisplaySettings(
        editingMaterial.publicDisplaySettings ??
          DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
      );
      setPublicSpecificationSettings(
        mapPublicSpecificationSettings(
          editingMaterial.modelSnapshot.specifications,
          editingMaterial.publicSpecificationSettings,
        ),
      );
      setHiddenSpecificationIds(
        editingMaterial.modelSnapshot.hiddenSpecificationIds ?? [],
      );
      previousModelId.current = editingMaterial.modelId;
    } else if (!isEdit) {
      form.reset(materialDefaultValues);
      setGalleryImages([]);
      setPublicDisplaySettings(DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS);
      setPublicSpecificationSettings({});
      setHiddenSpecificationIds([]);
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
      setHiddenSpecificationIds([]);
      setPublicDisplaySettings(currentModel.publicDisplaySettings);
      setPublicSpecificationSettings(
        mapPublicSpecificationSettings(currentModel.specifications),
      );

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
  const isLoading =
    isPermissionsPending ||
    (isEdit &&
      canView &&
      (materialQuery.isPending || custodiansQuery.isPending)) ||
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
            disabled={Boolean(editingMaterial?.reservedHandoverId)}
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
      hiddenSpecificationIds,
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
        publicDisplaySettings,
        publicSpecificationSettings,
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
    setActiveTab(
      errors.safetyInspectionChecklist
        ? 'inspection'
        : errors.specificationOverrides
          ? 'technical'
          : 'general',
    );
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
          className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto xl:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)] xl:overflow-hidden"
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
                <Info className="size-4" aria-hidden="true" />
                {intl.formatMessage({ id: 'project.materials.tabs.general' })}
              </TabsTrigger>
              <TabsTrigger
                value="technical"
                count={snapshotSpecifications?.length ?? 0}
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                {intl.formatMessage({
                  id: 'project.materials.tabs.specifications',
                })}
              </TabsTrigger>
              {requiresSafetyInspection ? (
                <TabsTrigger
                  value="inspection"
                  count={mergeSafetyInspectionChecklists(
                    inheritedInspectionChecklist,
                    inspectionChecklist,
                  ).reduce((count, group) => count + group.criteria.length, 0)}
                >
                  <ClipboardCheck className="size-4" aria-hidden="true" />
                  {intl.formatMessage({
                    id: 'project.materials.tabs.safetyChecklist',
                  })}
                </TabsTrigger>
              ) : null}
            </TabsList>
            <TabsContent
              value="general"
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain"
            >
              <Card className="min-w-0 shrink-0">
                <CardHeader className="min-h-0 px-5 py-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Boxes className="size-4 text-primary" aria-hidden="true" />
                    {intl.formatMessage({
                      id: 'project.materials.tabs.general',
                    })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-1">
                  <MaterialForm
                    id={FORM_ID}
                    mode={isEdit ? 'edit' : 'create'}
                    form={form}
                    onSubmit={handleSubmit}
                    models={availableModels}
                    renderFormElement={false}
                  />
                </CardContent>
              </Card>
              <MaterialOwnerCard
                form={form}
                parties={custodiansQuery.data ?? []}
                readOnly={isEdit}
                partyLoadError={
                  isEdit && custodiansQuery.isError
                    ? getApiErrorMessage(custodiansQuery.error)
                    : undefined
                }
                onRetry={() => void custodiansQuery.refetch()}
              />
              <Card className="min-w-0 shrink-0">
                <CardHeader className="min-h-0 px-5 py-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Eye className="size-4 text-primary" aria-hidden="true" />
                    {intl.formatMessage({
                      id: 'project.materials.form.publicDisplay.title',
                    })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 items-center gap-x-6 gap-y-4 p-5 pt-1">
                  <div className="col-span-2 flex min-w-0 items-center gap-3">
                    <Checkbox
                      id="material-public-basic-info"
                      checked={publicDisplaySettings.basicInfo}
                      onCheckedChange={(basicInfo) =>
                        setPublicDisplaySettings((current) => ({
                          ...current,
                          basicInfo: basicInfo === true,
                        }))
                      }
                    />
                    <Label
                      className="cursor-pointer peer-disabled:cursor-not-allowed"
                      htmlFor="material-public-basic-info"
                    >
                      {intl.formatMessage({
                        id: 'project.materials.form.publicDisplay.basicInfo',
                      })}
                    </Label>
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <Checkbox
                      id="material-public-specifications"
                      checked={publicDisplaySettings.specifications}
                      disabled={!publicDisplaySettings.basicInfo}
                      onCheckedChange={(specifications) =>
                        setPublicDisplaySettings((current) => ({
                          ...current,
                          specifications: specifications === true,
                        }))
                      }
                    />
                    <Label
                      className="cursor-pointer peer-disabled:cursor-not-allowed"
                      htmlFor="material-public-specifications"
                    >
                      {intl.formatMessage({
                        id: 'project.materials.form.publicDisplay.specifications',
                      })}
                    </Label>
                  </div>
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
                    specifications={snapshotSpecifications}
                    publicVisibilityDisabled={!publicDisplaySettings.basicInfo}
                    values={form.watch('specificationOverrides') ?? {}}
                    valueLabels={
                      form.watch('specificationOverrideLabels') ?? {}
                    }
                    publicSettings={publicSpecificationSettings}
                    onPublicSettingsChange={setPublicSpecificationSettings}
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
                    onRemoveSpecifications={(ids) =>
                      setHiddenSpecificationIds((current) =>
                        Array.from(new Set([...current, ...ids])),
                      )
                    }
                  />
                ) : (
                  <MaterialSpecificationsTable
                    mode="material"
                    specifications={null}
                    publicVisibilityDisabled={!publicDisplaySettings.basicInfo}
                    values={form.watch('specificationOverrides') ?? {}}
                    valueLabels={
                      form.watch('specificationOverrideLabels') ?? {}
                    }
                    publicSettings={publicSpecificationSettings}
                    onPublicSettingsChange={setPublicSpecificationSettings}
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
                    onRemoveSpecifications={() => {}}
                  />
                )}
              </Card>
            </TabsContent>
            {requiresSafetyInspection ? (
              <TabsContent
                value="inspection"
                className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain"
              >
                <Card className="min-w-0 shrink-0">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {intl.formatMessage({
                        id: 'project.materials.safetyInspection.checklist.inheritedTitle',
                      })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {groupQuery.isPending && groupQuery.isFetching ? (
                      <PageLoading
                        label={intl.formatMessage({
                          id: 'common.state.loading',
                        })}
                      />
                    ) : groupQuery.isError ? (
                      <ErrorState
                        title={intl.formatMessage({
                          id: 'materialGroups.errors.loadTitle',
                        })}
                        description={getApiErrorMessage(groupQuery.error)}
                        onRetry={() => void groupQuery.refetch()}
                      />
                    ) : (
                      <SafetyInspectionChecklistDisplay
                        groups={inheritedInspectionChecklist}
                      />
                    )}
                  </CardContent>
                </Card>
                <SafetyInspectionChecklistEditor
                  groups={inspectionChecklist}
                  onChange={(groups) =>
                    form.setValue('safetyInspectionChecklist', groups, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </TabsContent>
            ) : null}
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
    ownerPartyId: material.ownerPartyId ?? '',
    ownerSnapshot: {
      kind: material.ownerSnapshot.kind,
      code: material.ownerSnapshot.code,
      name: material.ownerSnapshot.name,
      representativeName: material.ownerSnapshot.representativeName,
      phone: material.ownerSnapshot.phone,
      email: material.ownerSnapshot.email,
      departmentId: material.ownerSnapshot.departmentId,
      departmentCode: material.ownerSnapshot.departmentCode,
      departmentName: material.ownerSnapshot.departmentName,
      teamId: material.ownerSnapshot.teamId,
      teamCode: material.ownerSnapshot.teamCode,
      teamName: material.ownerSnapshot.teamName,
      employeeId: material.ownerSnapshot.employeeId,
      scopePartyId: material.ownerSnapshot.scopePartyId,
    },
    condition: material.condition,
    note: material.note ?? '',
    specificationOverrides: { ...material.specificationOverrides },
    specificationOverrideLabels: {
      ...material.specificationOverrideLabels,
    },
    safetyInspectionChecklist: material.safetyInspectionChecklist ?? [],
  };
}
