import { useEffect, useMemo, useState } from 'react';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import { useMaterialGroupQuery } from '@/project/material-groups/hooks/use-material-groups';
import { MATERIAL_MODEL_IMAGES_BUCKET } from '@/project/material-models/api/material-models.api';
import { MaterialModelGalleryCard } from '@/project/material-models/forms/material-model-gallery-card';
import type {
  MaterialModel,
  MaterialPublicDisplaySettings,
} from '@/project/material-models/model/material-model';
import {
  DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
  mapPublicSpecificationSettings,
} from '@/project/material-models/model/material-model';
import { MaterialSpecificationsTable } from '@/project/material-models/table/material-specifications-table';
import { mergeSafetyInspectionChecklists } from '@/project/material-safety-inspections/model/safety-inspection-checklist';
import { MATERIAL_IMAGES_BUCKET } from '@/project/materials/api/materials.api';
import { MaterialOwnerCard } from '@/project/materials/components/material-owner-card';
import {
  MaterialForm,
  useMaterialForm,
} from '@/project/materials/forms/material-form.generated';
import type { MaterialFormSchemaValues } from '@/project/materials/forms/material-form.schema';
import { useMaterialCapitalSourcesQuery } from '@/project/materials/hooks/use-material-capital-sources';
import type {
  MaterialImageDraft,
  MaterialModelSafetyInspectionConfig,
  MaterialOwnerSnapshotDraft,
} from '@/project/materials/model/material';
import {
  MaterialInspectionScheduleCard,
  MaterialSafetyChecklistSection,
} from '@/project/materials/pages/material-editor-page';
import { ClipboardCheck, Eye, Info, SlidersHorizontal } from 'lucide-react';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ErrorState } from '@/components/ui/error-state';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/ui/loading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type {
  MaterialReceiptRepresentative,
  MaterialReceiptRepresentativeInput,
} from '../model/material-receipt';

interface MaterialReceiptLineMaterialDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: MaterialModel | null | undefined;
  modelLoading?: boolean;
  modelError?: unknown;
  onRetryModel?: () => void;
  quantity: number;
  warehouseId: string;
  representative?: MaterialReceiptRepresentative | null;
  readOnly?: boolean;
  requiresReason?: boolean;
  onSave: (
    representative: MaterialReceiptRepresentativeInput,
    reason: string,
  ) => void;
  isSaving?: boolean;
}
export function MaterialReceiptLineMaterialDrawer({
  open,
  onOpenChange,
  model,
  modelLoading = false,
  modelError,
  onRetryModel,
  quantity,
  warehouseId,
  representative,
  readOnly = false,
  requiresReason = false,
  onSave,
  isSaving = false,
}: MaterialReceiptLineMaterialDrawerProps) {
  const intl = useIntl();
  const form = useMaterialForm();
  const [images, setImages] = useState<MaterialImageDraft[]>([]);
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
  const [reason, setReason] = useState('');
  const custodiansQuery = useCustodiansQuery(open, open);
  const capitalSourcesQuery = useMaterialCapitalSourcesQuery(open);
  const warehouse = custodiansQuery.data?.find(
    (party) => party.id === warehouseId,
  );
  const currentModel = model ?? undefined;
  const groupQuery = useMaterialGroupQuery(
    currentModel?.groupId ?? '',
    open && Boolean(currentModel?.useGroupSafetyInspectionChecklist),
  );
  const modelChecklist = useMemo(
    () =>
      mergeSafetyInspectionChecklists(
        currentModel?.useGroupSafetyInspectionChecklist
          ? groupQuery.data?.safetyInspectionChecklist
          : undefined,
        currentModel?.safetyInspectionChecklist,
      ),
    [currentModel, groupQuery.data?.safetyInspectionChecklist],
  );
  const inspectionConfig = useMemo<MaterialModelSafetyInspectionConfig>(
    () => ({
      requiresInspection: currentModel?.requiresInspection ?? false,
      inspectionIntervalValue: currentModel?.inspectionIntervalValue ?? 12,
      inspectionIntervalUnit: currentModel?.inspectionIntervalUnit ?? 'month',
      skipInitialInspection: currentModel?.skipInitialInspection ?? false,
      safetyInspectionChecklist: modelChecklist,
    }),
    [currentModel, modelChecklist],
  );
  const snapshotSpecifications =
    currentModel?.specifications.filter(
      (specification) => !hiddenSpecificationIds.includes(specification.id),
    ) ?? null;
  const showInspectionTab = true;
  const isLoading = custodiansQuery.isPending || capitalSourcesQuery.isPending;
  const loadError = custodiansQuery.error ?? capitalSourcesQuery.error;

  useEffect(() => {
    if (!open || !model) return;
    const baseSnapshot: MaterialOwnerSnapshotDraft = {
      kind: 'warehouse',
      code: warehouse?.code ?? '',
      name: warehouse?.name ?? '',
      representativeName: warehouse?.representativeName ?? '',
      phone: warehouse?.phone ?? '',
      email: warehouse?.email ?? '',
    };
    const baseValues: MaterialFormSchemaValues = {
      code: 'REPRESENTATIVE',
      modelId: model.id,
      nameOverride: '',
      descriptionOverride: '',
      unit: model.unit,
      serialNumber: '',
      placedIntoServiceDate: '',
      capitalSourceId: '',
      unitPriceOverride: null,
      isActive: true,
      ownerPartyId: warehouseId,
      ownerSnapshot: baseSnapshot,
      condition: 'good',
      note: '',
      specificationOverrides: {},
      specificationOverrideLabels: {},
      inspectionSettingsOverrideEnabled: false,
      requiresInspectionOverride: model.requiresInspection,
      inspectionIntervalValueOverride: model.inspectionIntervalValue,
      inspectionIntervalUnitOverride: model.inspectionIntervalUnit,
      safetyInspectionChecklistOverrideEnabled: false,
      safetyInspectionChecklistOverride: [],
    };
    const savedValues = representative?.materialValues;
    form.reset({
      ...baseValues,
      ...(savedValues ?? {}),
      code: savedValues?.code || 'REPRESENTATIVE',
      modelId: model.id,
      serialNumber: '',
      ownerPartyId: warehouseId,
      ownerSnapshot: savedValues?.ownerSnapshot ?? baseSnapshot,
      condition: 'good',
    });
    const savedImages = representative?.images;
    setImages(
      savedImages?.length
        ? savedImages
        : (model.images ?? []).map((image) => ({
            ...image,
            storageBucket: MATERIAL_MODEL_IMAGES_BUCKET,
          })),
    );
    const defaults =
      representative?.publicDisplaySettings ?? model.publicDisplaySettings;
    setPublicDisplaySettings(
      defaults ?? DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
    );
    setPublicSpecificationSettings(
      mapPublicSpecificationSettings(
        model.specifications,
        representative?.publicSpecificationSettings,
      ),
    );
    setHiddenSpecificationIds([]);
    setActiveTab('general');
    setReason('');
  }, [form, model, open, representative, warehouse, warehouseId]);

  const handleSave = form.handleSubmit((values) => {
    if (readOnly || (requiresReason && !reason.trim())) return;
    if (images.length && !images.some((image) => image.isCover)) return;
    onSave(
      {
        materialValues: {
          ...values,
          code: 'REPRESENTATIVE',
          modelId: model!.id,
          ownerPartyId: warehouseId,
          ownerSnapshot: warehouse
            ? {
                kind: 'warehouse',
                code: warehouse.code,
                name: warehouse.name,
                representativeName: warehouse.representativeName ?? '',
                phone: warehouse.phone ?? '',
                email: warehouse.email ?? '',
              }
            : values.ownerSnapshot,
          hiddenSpecificationIds,
        },
        images,
        publicDisplaySettings,
        publicSpecificationSettings,
      },
      reason.trim(),
    );
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="top-auto bottom-0 h-[min(92dvh,68rem)] max-h-[calc(100dvh-1rem)] rounded-t-xl [&>div:first-child]:hidden">
        <DrawerHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
          <DrawerTitle>
            {intl.formatMessage({ id: 'project.materials.page.editTitle' })}
          </DrawerTitle>
          <DrawerDescription>
            {model?.name ?? ''} ·{' '}
            {intl.formatMessage({ id: 'receipts.fields.quantity' })}: {quantity}
          </DrawerDescription>
        </DrawerHeader>
        {modelLoading ? (
          <PageLoading
            label={intl.formatMessage({ id: 'common.state.loading' })}
          />
        ) : !model ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <ErrorState
              title={intl.formatMessage({
                id: 'project.materials.errors.loadDetailTitle',
              })}
              description={getApiErrorMessage(modelError)}
              onRetry={onRetryModel}
            />
          </div>
        ) : isLoading ? (
          <PageLoading
            label={intl.formatMessage({ id: 'common.state.loading' })}
          />
        ) : loadError ? (
          <div className="p-6">
            <ErrorState
              title={intl.formatMessage({
                id: 'project.materials.errors.loadDetailTitle',
              })}
              description={getApiErrorMessage(loadError)}
              onRetry={() => {
                void custodiansQuery.refetch();
                void capitalSourcesQuery.refetch();
              }}
            />
          </div>
        ) : (
          <form
            id="receipt-representative-form"
            onSubmit={handleSave}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-4 py-4 lg:px-6 xl:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)] xl:grid-rows-[minmax(0,1fr)_auto] xl:overflow-hidden">
              <div className="min-h-0 xl:row-span-2">
                <MaterialModelGalleryCard
                  images={images}
                  messagePrefix="project.materials.gallery"
                  onImagesChange={(nextImages) =>
                    setImages(
                      nextImages.map((image) =>
                        image.file
                          ? { ...image, storageBucket: MATERIAL_IMAGES_BUCKET }
                          : image,
                      ),
                    )
                  }
                />
              </div>
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex min-h-[32rem] min-w-0 flex-col"
              >
                <TabsList variant="line" size="md" className="w-full">
                  <TabsTrigger value="general">
                    <Info className="size-4" />
                    {intl.formatMessage({
                      id: 'project.materials.tabs.general',
                    })}
                  </TabsTrigger>
                  <TabsTrigger
                    value="technical"
                    count={snapshotSpecifications?.length ?? 0}
                  >
                    <SlidersHorizontal className="size-4" />
                    {intl.formatMessage({
                      id: 'project.materials.tabs.specifications',
                    })}
                  </TabsTrigger>
                  {showInspectionTab ? (
                    <TabsTrigger value="inspection">
                      <ClipboardCheck className="size-4" />
                      {intl.formatMessage({
                        id: 'project.materials.tabs.safetyChecklist',
                      })}
                    </TabsTrigger>
                  ) : null}
                </TabsList>
                <TabsContent
                  value="general"
                  className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
                >
                  <Card className="shrink-0">
                    <CardHeader className="px-5 py-4">
                      <CardTitle className="text-base">
                        {intl.formatMessage({
                          id: 'project.materials.tabs.general',
                        })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-1">
                      <MaterialForm
                        id="receipt-representative-form"
                        mode="edit"
                        hideCode
                        form={form}
                        onSubmit={() => undefined}
                        models={[model]}
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
                    readOnly
                  />
                  <Card className="shrink-0">
                    <CardHeader className="px-5 py-4">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Eye className="size-4 text-primary" />
                        {intl.formatMessage({
                          id: 'project.materials.form.publicDisplay.title',
                        })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 items-center gap-4 p-5 pt-1">
                      <div className="col-span-2 flex items-center gap-3">
                        <Checkbox
                          id="receipt-rep-public-basic"
                          checked={publicDisplaySettings.basicInfo}
                          onCheckedChange={(value) =>
                            setPublicDisplaySettings((current) => ({
                              ...current,
                              basicInfo: value === true,
                            }))
                          }
                        />
                        <Label htmlFor="receipt-rep-public-basic">
                          {intl.formatMessage({
                            id: 'project.materials.form.publicDisplay.basicInfo',
                          })}
                        </Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="receipt-rep-public-specs"
                          checked={publicDisplaySettings.specifications}
                          disabled={!publicDisplaySettings.basicInfo}
                          onCheckedChange={(value) =>
                            setPublicDisplaySettings((current) => ({
                              ...current,
                              specifications: value === true,
                            }))
                          }
                        />
                        <Label htmlFor="receipt-rep-public-specs">
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
                  className="min-h-[32rem] overflow-hidden"
                >
                  <Card className="min-h-[32rem] overflow-hidden">
                    <MaterialSpecificationsTable
                      mode="material"
                      specifications={snapshotSpecifications}
                      publicVisibilityDisabled={
                        !publicDisplaySettings.basicInfo
                      }
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
                  </Card>
                </TabsContent>
                {showInspectionTab ? (
                  <TabsContent
                    value="inspection"
                    className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
                  >
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
                      <MaterialInspectionScheduleCard
                        form={form}
                        modelName={model.name}
                        modelSafetyInspectionConfig={inspectionConfig}
                      />
                    )}
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {intl.formatMessage({
                            id: 'project.materials.tabs.safetyChecklist',
                          })}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <MaterialSafetyChecklistSection
                          form={form}
                          modelChecklist={modelChecklist}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                ) : null}
              </Tabs>
              {requiresReason ? (
                <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)] xl:col-start-2">
                  <Label htmlFor="receipt-representative-reason">
                    {intl.formatMessage({ id: 'receipts.fields.reason' })}
                    <span className="ml-1 text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="receipt-representative-reason"
                    rows={2}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
              ) : null}
            </div>
            <DrawerFooter className="shrink-0 flex-row justify-end border-t border-border px-6 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {intl.formatMessage({ id: 'common.actions.cancel' })}
              </Button>
              {!readOnly ? (
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSaving}
                  loadingText={intl.formatMessage({
                    id: 'common.state.saving',
                  })}
                  disabled={
                    (requiresReason && !reason.trim()) ||
                    (images.length > 0 &&
                      !images.some((image) => image.isCover))
                  }
                >
                  {intl.formatMessage({ id: 'common.actions.save' })}
                </Button>
              ) : null}
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  );
}
