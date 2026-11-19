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
  Pencil,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import type { SubmitErrorHandler, UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertToolbar,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/ui/loading';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
import { useMaterialCapitalSourcesQuery } from '../hooks/use-material-capital-sources';
import {
  useMaterialQuery,
  useSaveMaterialMutation,
} from '../hooks/use-materials';
import {
  getMaterialInspectionSettings,
  type Material,
  type MaterialCondition,
  type MaterialFormValues,
  type MaterialImageDraft,
  type MaterialModelSafetyInspectionConfig,
  type MaterialModelSnapshot,
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
  const capitalSourcesQuery = useMaterialCapitalSourcesQuery(
    !isPermissionsPending && (canManage || (isEdit && canView)),
  );
  const saveMutation = useSaveMaterialMutation();
  const editingMaterial = materialQuery.data;
  const selectedModelId = form.watch('modelId');
  const previousModelId = useRef('');
  const hydratedModelId = useRef('');
  const hydratedMaterialRef = useRef<{ id: string; version: number } | null>(
    null,
  );
  const currentModel = modelsQuery.data?.find(
    (model) =>
      model.id === (isEdit ? editingMaterial?.modelId : selectedModelId),
  );
  const groupQuery = useMaterialGroupQuery(
    currentModel?.groupId ?? '',
    !isPermissionsPending && !isEdit && Boolean(currentModel),
  );
  const snapshot = isEdit ? editingMaterial?.modelSnapshot : currentModel;
  const inheritedInspectionChecklist = isEdit
    ? mergeSafetyInspectionChecklists(
        editingMaterial?.modelSafetyInspectionConfig.safetyInspectionChecklist,
      )
    : mergeSafetyInspectionChecklists(
        currentModel?.useGroupSafetyInspectionChecklist
          ? groupQuery.data?.safetyInspectionChecklist
          : undefined,
        currentModel?.safetyInspectionChecklist,
      );
  const showInspectionTab =
    isEdit ||
    Boolean(snapshot?.requiresInspection) ||
    inheritedInspectionChecklist.length > 0;
  const snapshotSpecifications =
    snapshot?.specifications.filter(
      (specification) => !hiddenSpecificationIds.includes(specification.id),
    ) ?? null;

  useEffect(() => {
    if (isEdit && editingMaterial) {
      if (
        hydratedMaterialRef.current?.id === editingMaterial.id &&
        hydratedMaterialRef.current.version === editingMaterial.version
      ) {
        return;
      }
      hydratedMaterialRef.current = {
        id: editingMaterial.id,
        version: editingMaterial.version,
      };
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
      hydratedMaterialRef.current = null;
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
      const currentUnit = form.getValues('unit');
      if (!currentUnit || currentUnit === previousModel?.unit) {
        form.setValue('unit', currentModel.unit, { shouldDirty: true });
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
      (materialQuery.isPending ||
        custodiansQuery.isPending ||
        capitalSourcesQuery.isPending)) ||
    (!isEdit &&
      canManage &&
      (modelsQuery.isPending ||
        custodiansQuery.isPending ||
        capitalSourcesQuery.isPending));
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
    const { codeMode, ...formValues } = values;
    const payload: MaterialFormValues = {
      ...formValues,
      code: isEdit || codeMode === 'manual' ? values.code.trim() : '',
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
      errors.inspectionSettingsOverrideEnabled ||
        errors.requiresInspectionOverride ||
        errors.inspectionIntervalValueOverride ||
        errors.inspectionIntervalUnitOverride ||
        errors.safetyInspectionChecklistOverride
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
        capitalSourcesQuery.isError ||
        (!isEdit && (modelsQuery.isError || custodiansQuery.isError)) ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.errors.loadDetailTitle',
          })}
          description={getApiErrorMessage(
            materialQuery.error ??
              modelsQuery.error ??
              custodiansQuery.error ??
              capitalSourcesQuery.error,
          )}
          onRetry={() => {
            if (isEdit) void materialQuery.refetch();
            else {
              void modelsQuery.refetch();
              void custodiansQuery.refetch();
            }
            void capitalSourcesQuery.refetch();
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
              {showInspectionTab ? (
                <TabsTrigger
                  value="inspection"
                  count={inheritedInspectionChecklist.reduce(
                    (count, group) => count + group.criteria.length,
                    0,
                  )}
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
                    capitalSourceIdOptions={(
                      capitalSourcesQuery.data ?? []
                    ).map((source) => ({
                      value: source.id,
                      label: source.name,
                    }))}
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
            {showInspectionTab ? (
              <TabsContent
                value="inspection"
                className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain"
              >
                {isEdit && editingMaterial ? (
                  <MaterialInspectionScheduleCard
                    form={form}
                    modelName={
                      currentModel?.name ?? editingMaterial.modelSnapshot.name
                    }
                    modelSafetyInspectionConfig={
                      editingMaterial.modelSafetyInspectionConfig
                    }
                  />
                ) : null}
                {!isEdit && groupQuery.isPending && groupQuery.isFetching ? (
                  <PageLoading
                    label={intl.formatMessage({ id: 'common.state.loading' })}
                  />
                ) : !isEdit && groupQuery.isError ? (
                  <ErrorState
                    title={intl.formatMessage({
                      id: 'materialGroups.errors.loadTitle',
                    })}
                    description={getApiErrorMessage(groupQuery.error)}
                    onRetry={() => void groupQuery.refetch()}
                  />
                ) : isEdit && editingMaterial ? (
                  <MaterialSafetyChecklistSection
                    form={form}
                    modelChecklist={inheritedInspectionChecklist}
                  />
                ) : (
                  <SafetyInspectionChecklistDisplay
                    groups={inheritedInspectionChecklist}
                  />
                )}
              </TabsContent>
            ) : null}
          </Tabs>
        </form>
      )}
    </div>
  );
}

function mapMaterialToForm(material: Material): MaterialFormSchemaValues {
  const inspectionSettings = getMaterialInspectionSettings(material);
  return {
    code: material.code,
    codeMode: 'manual',
    modelId: material.modelId,
    nameOverride: material.nameOverride ?? '',
    descriptionOverride: material.descriptionOverride ?? '',
    unit: material.modelSnapshot.unit,
    serialNumber: material.serialNumber ?? '',
    linkedCodes: material.linkedCodes.map((code) => ({ ...code })),
    placedIntoServiceDate: material.placedIntoServiceDate ?? '',
    capitalSourceId: material.capitalSourceId ?? '',
    unitPriceOverride: material.unitPriceOverride,
    isActive: material.isActive,
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
    inspectionSettingsOverrideEnabled:
      material.inspectionSettingsOverrideEnabled,
    requiresInspectionOverride: inspectionSettings.requiresInspection,
    inspectionIntervalValueOverride: inspectionSettings.inspectionIntervalValue,
    inspectionIntervalUnitOverride: inspectionSettings.inspectionIntervalUnit,
    safetyInspectionChecklistOverrideEnabled:
      material.safetyInspectionChecklistOverrideEnabled,
    safetyInspectionChecklistOverride:
      material.safetyInspectionChecklistOverride ?? [],
  };
}

export function MaterialInspectionScheduleCard({
  form,
  modelName,
  modelSafetyInspectionConfig,
}: {
  form: UseFormReturn<MaterialFormSchemaValues>;
  modelName: string;
  modelSafetyInspectionConfig: MaterialModelSafetyInspectionConfig;
}) {
  const intl = useIntl();
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const overrideEnabled =
    form.watch('inspectionSettingsOverrideEnabled') === true;
  const requiresInspection = overrideEnabled
    ? (form.watch('requiresInspectionOverride') ??
      modelSafetyInspectionConfig.requiresInspection)
    : modelSafetyInspectionConfig.requiresInspection;

  const enableScheduleOverride = () => {
    form.setValue(
      'requiresInspectionOverride',
      modelSafetyInspectionConfig.requiresInspection,
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue(
      'inspectionIntervalValueOverride',
      modelSafetyInspectionConfig.inspectionIntervalValue,
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue(
      'inspectionIntervalUnitOverride',
      modelSafetyInspectionConfig.inspectionIntervalUnit,
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue('inspectionSettingsOverrideEnabled', true, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const restoreModelSettings = () => {
    form.setValue('inspectionSettingsOverrideEnabled', false, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue(
      'requiresInspectionOverride',
      modelSafetyInspectionConfig.requiresInspection,
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue(
      'inspectionIntervalValueOverride',
      modelSafetyInspectionConfig.inspectionIntervalValue,
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue(
      'inspectionIntervalUnitOverride',
      modelSafetyInspectionConfig.inspectionIntervalUnit,
      { shouldDirty: true, shouldValidate: true },
    );
  };

  return (
    <Card className="min-w-0 shrink-0">
      <CardContent className="p-5">
        <Form {...form}>
          <div className="flex flex-col gap-4">
            <Alert
              variant={overrideEnabled ? 'warning' : 'success'}
              appearance="light"
            >
              <AlertContent>
                <AlertDescription>
                  {intl.formatMessage({
                    id: overrideEnabled
                      ? 'project.materials.inspectionSchedule.customStatus'
                      : 'project.materials.inspectionSchedule.modelStatus',
                  })}{' '}
                  <strong className="font-semibold">{modelName}</strong>
                </AlertDescription>
              </AlertContent>
              <AlertToolbar className="ms-auto flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (overrideEnabled) {
                      setIsRestoreDialogOpen(true);
                    } else {
                      enableScheduleOverride();
                    }
                  }}
                >
                  {overrideEnabled ? (
                    <RotateCcw aria-hidden="true" />
                  ) : (
                    <Pencil aria-hidden="true" />
                  )}
                  {intl.formatMessage({
                    id: overrideEnabled
                      ? 'project.materials.inspectionSchedule.restoreDefault'
                      : 'project.materials.inspectionSchedule.edit',
                  })}
                </Button>
              </AlertToolbar>
            </Alert>
            <FormField
              control={form.control}
              name="requiresInspectionOverride"
              render={({ field }) => (
                <FormItem
                  layout="horizontal"
                  labelWidth="md"
                  alignment="center"
                >
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'materialModels.fields.requiresInspection',
                    })}
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={
                        overrideEnabled
                          ? (field.value ??
                            modelSafetyInspectionConfig.requiresInspection)
                          : modelSafetyInspectionConfig.requiresInspection
                      }
                      onCheckedChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      disabled={!overrideEnabled}
                      aria-label={intl.formatMessage({
                        id: 'materialModels.fields.requiresInspection',
                      })}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {requiresInspection ? (
              <>
                <FormField
                  control={form.control}
                  name="inspectionIntervalValueOverride"
                  render={({ field }) => (
                    <FormItem
                      layout="horizontal"
                      labelWidth="md"
                      alignment="center"
                    >
                      <FormLabel htmlFor="material-inspection-interval">
                        {intl.formatMessage({
                          id: 'materialModels.fields.inspectionInterval',
                        })}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          id="material-inspection-interval"
                          type="number"
                          min={1}
                          step={1}
                          readOnly={!overrideEnabled}
                          aria-readonly={!overrideEnabled}
                          aria-label={intl.formatMessage({
                            id: 'materialModels.fields.inspectionInterval',
                          })}
                          value={
                            overrideEnabled
                              ? (field.value ?? '')
                              : modelSafetyInspectionConfig.inspectionIntervalValue
                          }
                          onChange={(event) => {
                            field.onChange(
                              event.target.value === ''
                                ? ''
                                : Number(event.target.value),
                            );
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="inspectionIntervalUnitOverride"
                  render={({ field }) => (
                    <FormItem
                      layout="horizontal"
                      labelWidth="md"
                      alignment="center"
                    >
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'materialModels.fields.inspectionIntervalUnit',
                        })}
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={
                            overrideEnabled
                              ? (field.value ??
                                modelSafetyInspectionConfig.inspectionIntervalUnit)
                              : modelSafetyInspectionConfig.inspectionIntervalUnit
                          }
                          onValueChange={field.onChange}
                          disabled={!overrideEnabled}
                        >
                          <SelectTrigger
                            aria-label={intl.formatMessage({
                              id: 'materialModels.fields.inspectionIntervalUnit',
                            })}
                            onBlur={field.onBlur}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">
                              {intl.formatMessage({
                                id: 'materialModels.inspectionIntervalUnits.day',
                              })}
                            </SelectItem>
                            <SelectItem value="month">
                              {intl.formatMessage({
                                id: 'materialModels.inspectionIntervalUnits.month',
                              })}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem
                  layout="horizontal"
                  labelWidth="md"
                  alignment="center"
                >
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'materialModels.fields.skipInitialInspection',
                    })}
                  </FormLabel>
                  <FormControl>
                    <Checkbox
                      checked={
                        modelSafetyInspectionConfig.skipInitialInspection
                      }
                      disabled
                      aria-label={intl.formatMessage({
                        id: 'materialModels.fields.skipInitialInspection',
                      })}
                    />
                  </FormControl>
                </FormItem>
              </>
            ) : null}
          </div>
        </Form>
        <ConfirmDialog
          open={isRestoreDialogOpen}
          onOpenChange={setIsRestoreDialogOpen}
          title={intl.formatMessage({
            id: 'project.materials.inspectionSchedule.restoreDialogTitle',
          })}
          description={intl.formatMessage({
            id: 'project.materials.inspectionSchedule.restoreDialogDescription',
          })}
          confirmLabel={intl.formatMessage({
            id: 'project.materials.inspectionSchedule.restoreDefault',
          })}
          confirmVariant="destructive"
          onConfirm={restoreModelSettings}
        />
      </CardContent>
    </Card>
  );
}

export function MaterialSafetyChecklistSection({
  form,
  modelChecklist,
}: {
  form: UseFormReturn<MaterialFormSchemaValues>;
  modelChecklist: NonNullable<
    MaterialModelSnapshot['safetyInspectionChecklist']
  >;
}) {
  const intl = useIntl();
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const overrideEnabled =
    form.watch('safetyInspectionChecklistOverrideEnabled') === true;
  const overrideChecklist =
    form.watch('safetyInspectionChecklistOverride') ?? [];
  const displayedChecklist = overrideEnabled
    ? overrideChecklist
    : modelChecklist;
  const criteriaCount = displayedChecklist.reduce(
    (count, group) => count + group.criteria.length,
    0,
  );

  const enableChecklistOverride = () => {
    form.setValue(
      'safetyInspectionChecklistOverride',
      modelChecklist.map((group) => ({
        ...group,
        criteria: group.criteria.map((criterion) => ({ ...criterion })),
      })),
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue('safetyInspectionChecklistOverrideEnabled', true, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const restoreModelChecklist = () => {
    form.setValue('safetyInspectionChecklistOverrideEnabled', false, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('safetyInspectionChecklistOverride', [], {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm text-foreground">
          {intl.formatMessage(
            { id: 'project.materials.safetyInspection.checklist.count' },
            { groups: displayedChecklist.length, criteria: criteriaCount },
          )}
        </span>
        <Badge
          variant={overrideEnabled ? 'warning' : 'success'}
          appearance="light"
          size="sm"
        >
          {intl.formatMessage({
            id: overrideEnabled
              ? 'project.materials.safetyInspection.checklist.customStatus'
              : 'project.materials.safetyInspection.checklist.modelStatus',
          })}
        </Badge>
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (overrideEnabled) setIsRestoreDialogOpen(true);
              else enableChecklistOverride();
            }}
          >
            {overrideEnabled ? (
              <RotateCcw aria-hidden="true" />
            ) : (
              <Pencil aria-hidden="true" />
            )}
            {intl.formatMessage({
              id: overrideEnabled
                ? 'project.materials.safetyInspection.checklist.restoreDefault'
                : 'project.materials.safetyInspection.checklist.edit',
            })}
          </Button>
        </div>
      </div>
      {overrideEnabled ? (
        <SafetyInspectionChecklistEditor
          groups={overrideChecklist}
          showCount={false}
          onChange={(groups) =>
            form.setValue('safetyInspectionChecklistOverride', groups, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
      ) : (
        <SafetyInspectionChecklistDisplay
          groups={modelChecklist}
          showCount={false}
        />
      )}
      <ConfirmDialog
        open={isRestoreDialogOpen}
        onOpenChange={setIsRestoreDialogOpen}
        title={intl.formatMessage({
          id: 'project.materials.safetyInspection.checklist.restoreDialogTitle',
        })}
        description={intl.formatMessage({
          id: 'project.materials.safetyInspection.checklist.restoreDialogDescription',
        })}
        confirmLabel={intl.formatMessage({
          id: 'project.materials.safetyInspection.checklist.restoreDefault',
        })}
        confirmVariant="destructive"
        onConfirm={restoreModelChecklist}
      />
    </div>
  );
}
