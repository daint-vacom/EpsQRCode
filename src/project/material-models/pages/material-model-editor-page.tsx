import { useEffect, useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useCodeGenerationPatternsQuery } from '@/project/code-generation/hooks/use-code-generation-patterns';
import { DEFAULT_CODE_GENERATION_PATTERNS } from '@/project/code-generation/model/code-pattern-example';
import { useMaterialGroupQuery } from '@/project/material-groups/hooks/use-material-groups';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { InputSelect } from '@/components/ui/input-select';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import {
  mapMaterialModelToFormValues,
  MaterialModelForm,
  useMaterialModelForm,
} from '../forms/material-model-form.generated';
import { MaterialModelGalleryCard } from '../forms/material-model-gallery-card';
import {
  useCreateMaterialModelMutation,
  useMaterialModelsQuery,
  useUpdateMaterialModelMutation,
} from '../hooks/use-material-models';
import type {
  MaterialModelFormValues,
  MaterialModelImageDraft,
  MaterialPublicDisplaySettings,
} from '../model/material-model';
import { DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS } from '../model/material-model';
import { MATERIAL_MODEL_PERMISSION_CODES } from '../model/material-model-permissions';
import { MaterialGroupSpecificationsInheritedTable } from '../table/material-group-specifications-inherited-table';
import { MaterialSpecificationsTable } from '../table/material-specifications-table';

export function MaterialModelEditorPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_MODEL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_MODEL_PERMISSION_CODES.manage);
  const codePatternsQuery = useCodeGenerationPatternsQuery(
    !isPermissionsPending && canManage,
  );
  const codePattern =
    codePatternsQuery.data?.find((item) => item.entityKey === 'material_model')
      ?.pattern ?? DEFAULT_CODE_GENERATION_PATTERNS.material_model;
  const query = useMaterialModelsQuery(
    isEdit && (isPermissionsPending || canView),
  );
  const createMutation = useCreateMaterialModelMutation();
  const updateMutation = useUpdateMaterialModelMutation();
  const form = useMaterialModelForm();
  const groupId = form.watch('groupId');
  const groupQuery = useMaterialGroupQuery(
    groupId,
    !isPermissionsPending && canManage,
  );
  const [galleryImages, setGalleryImages] = useState<MaterialModelImageDraft[]>(
    [],
  );
  const [publicDisplaySettings, setPublicDisplaySettings] =
    useState<MaterialPublicDisplaySettings>(
      DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
    );
  const [activeTab, setActiveTab] = useState('general');
  const requiresInspection = form.watch('requiresInspection');
  const specificationCount =
    (groupQuery.data?.specifications.length ?? 0) +
    (form.watch('specifications')?.length ?? 0);
  const inspectionChecklist = form.watch('safetyInspectionChecklist') ?? [];
  const useGroupSafetyInspectionChecklist = form.watch(
    'useGroupSafetyInspectionChecklist',
  );
  const inspectionChecklistCount = requiresInspection
    ? mergeSafetyInspectionChecklists(
        useGroupSafetyInspectionChecklist
          ? groupQuery.data?.safetyInspectionChecklist
          : undefined,
        inspectionChecklist,
      ).reduce((count, group) => count + group.criteria.length, 0)
    : 0;
  const specificationErrorCount = countFormErrors(
    form.formState.errors.specifications,
  );
  const generalErrorCount = Object.entries(form.formState.errors)
    .filter(([field]) => field !== 'specifications')
    .reduce((count, [, error]) => count + countFormErrors(error), 0);
  const editingModel = id
    ? (query.data?.find((model) => model.id === id) ?? null)
    : null;

  useEffect(() => {
    if (editingModel) {
      form.reset(mapMaterialModelToFormValues(editingModel));
      setGalleryImages(
        editingModel.images.map((image) => ({
          ...image,
          sortOrder: image.sortOrder,
        })),
      );
      setPublicDisplaySettings(
        editingModel.publicDisplaySettings ??
          DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
      );
    } else if (!isEdit) {
      form.reset();
      setGalleryImages([]);
      setPublicDisplaySettings(DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS);
    }
  }, [editingModel, form, isEdit]);

  const handleSubmit = (values: MaterialModelFormValues) => {
    if (!canManage) return;
    if (
      galleryImages.length > 0 &&
      !galleryImages.some((image) => image.isCover)
    ) {
      toast.error(
        intl.formatMessage({ id: 'materialModels.gallery.coverRequired' }),
      );
      return;
    }
    if (values.codeMode === 'manual' && !values.code.trim()) {
      form.setError('code', {
        type: 'manual',
        message: intl.formatMessage({
          id: 'materialModels.errors.codeRequired',
        }),
      });
      setActiveTab('general');
      toast.error(
        intl.formatMessage({ id: 'materialModels.errors.codeRequired' }),
      );
      return;
    }
    if (isEdit && id) {
      updateMutation.mutate(
        {
          id,
          values,
          images: galleryImages,
          previousImages: editingModel?.images ?? [],
          publicDisplaySettings,
        },
        {
          onSuccess: () => {
            toast.success(
              intl.formatMessage({ id: 'materialModels.toasts.updated' }),
            );
            navigate(ROUTES.PROJECT.MATERIAL_MODELS);
          },
          onError: (error) => toast.error(getApiErrorMessage(error)),
        },
      );
      return;
    }
    createMutation.mutate(
      { values, images: galleryImages, publicDisplaySettings },
      {
        onSuccess: () => {
          toast.success(
            intl.formatMessage({ id: 'materialModels.toasts.created' }),
          );
          navigate(ROUTES.PROJECT.MATERIAL_MODELS);
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  const handleInvalidSubmit: SubmitErrorHandler<MaterialModelFormValues> = (
    errors,
  ) => {
    setActiveTab(
      errors.safetyInspectionChecklist
        ? 'inspection'
        : errors.specifications
          ? 'technical'
          : 'general',
    );
    toast.error(intl.formatMessage({ id: 'materialModels.errors.validation' }));
  };

  const isLoading =
    isPermissionsPending || (isEdit && canView && query.isPending);
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const title = intl.formatMessage({
    id: isEdit
      ? 'materialModels.dialogs.editTitle'
      : 'materialModels.dialogs.createTitle',
  });
  const header = useMemo(
    () => ({
      title,
      icon: Boxes,
      showBackButton: true,
      backLabel: intl.formatMessage({ id: 'materialModels.actions.back' }),
      onBack: () => navigate(ROUTES.PROJECT.MATERIAL_MODELS),
      actions:
        canManage && (!isEdit || editingModel) ? (
          <Button
            type="submit"
            form="materialModel-form"
            variant="primary"
            size="md"
            loading={isSaving}
            loadingText={intl.formatMessage({ id: 'common.state.saving' })}
          >
            <Save />
            {intl.formatMessage({ id: 'common.actions.save' })}
          </Button>
        ) : null,
    }),
    [canManage, editingModel, intl, isEdit, isSaving, navigate, title],
  );
  useDetailEntryLayoutHeader(header);

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-hidden p-4 lg:p-5">
      {isLoading ? (
        <PageLoading
          label={intl.formatMessage({ id: 'common.state.loading' })}
        />
      ) : !canManage ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'materialModels.errors.authorizationTitle',
          })}
          description={intl.formatMessage({
            id: 'materialModels.errors.authorization',
          })}
        />
      ) : isEdit && !canView ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'materialModels.errors.authorizationTitle',
          })}
          description={intl.formatMessage({
            id: 'materialModels.errors.authorization',
          })}
        />
      ) : isEdit && query.isError ? (
        <ErrorState
          title={intl.formatMessage({ id: 'materialModels.errors.loadTitle' })}
          description={getApiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : isEdit && !editingModel ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'materialModels.errors.notFoundTitle',
          })}
          description={intl.formatMessage({
            id: 'materialModels.errors.notFound',
          })}
        />
      ) : (
        <form
          id="materialModel-form"
          onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)}
          className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto xl:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)] xl:overflow-hidden"
        >
          <MaterialModelGalleryCard
            key={id ?? 'create'}
            images={galleryImages}
            onImagesChange={setGalleryImages}
          />
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-[32rem] min-w-0 flex-1 flex-col xl:overflow-hidden"
          >
            <TabsList variant="line" size="md" className="w-full">
              <TabsTrigger
                value="general"
                afterCount={<FormTabErrorBadge count={generalErrorCount} />}
              >
                <Info className="size-4" aria-hidden="true" />
                {intl.formatMessage({ id: 'materialModels.tabs.general' })}
              </TabsTrigger>
              <TabsTrigger
                value="technical"
                count={specificationCount}
                afterCount={
                  <FormTabErrorBadge count={specificationErrorCount} />
                }
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                {intl.formatMessage({ id: 'materialModels.tabs.technical' })}
              </TabsTrigger>
              <TabsTrigger value="inspection" count={inspectionChecklistCount}>
                <ClipboardCheck className="size-4" aria-hidden="true" />
                {intl.formatMessage({ id: 'materialModels.tabs.inspection' })}
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="general"
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain"
            >
              <Card className="min-w-0 shrink-0">
                <CardContent className="p-5">
                  <MaterialModelForm
                    form={form}
                    onSubmit={handleSubmit}
                    renderFormElement={false}
                    mode={isEdit ? 'edit' : 'create'}
                    codePattern={codePattern}
                    resetKey={id ?? 'create'}
                  />
                </CardContent>
              </Card>
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
                      id="model-public-basic-info"
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
                      htmlFor="model-public-basic-info"
                    >
                      {intl.formatMessage({
                        id: 'project.materials.form.publicDisplay.basicInfo',
                      })}
                    </Label>
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <Checkbox
                      id="model-public-specifications"
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
                      htmlFor="model-public-specifications"
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
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain"
            >
              <Card className="flex min-h-[20rem] min-w-0 shrink-0 flex-col overflow-hidden">
                <MaterialGroupSpecificationsInheritedTable
                  groupId={groupId}
                  group={groupQuery.data}
                  isLoading={groupQuery.isPending && groupQuery.isFetching}
                  error={groupQuery.isError ? groupQuery.error : null}
                  onRetry={() => void groupQuery.refetch()}
                />
              </Card>
              <Card className="flex min-h-[32rem] min-w-0 shrink-0 flex-col overflow-hidden">
                <MaterialSpecificationsTable
                  mode="model"
                  form={form}
                  publicVisibilityDisabled={!publicDisplaySettings.basicInfo}
                  title={intl.formatMessage({
                    id: 'materialModels.specifications.modelTableTitle',
                  })}
                />
              </Card>
            </TabsContent>
            <TabsContent
              value="inspection"
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain"
            >
              <Card className="min-w-0 shrink-0">
                <CardContent className="p-5">
                  <Form {...form}>
                    <div className="flex flex-col gap-4">
                      <FormField
                        control={form.control}
                        name="requiresInspection"
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
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                aria-label={intl.formatMessage({
                                  id: 'materialModels.fields.requiresInspection',
                                })}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      {requiresInspection ? (
                        <>
                          <FormField
                            control={form.control}
                            name="inspectionIntervalValue"
                            render={({ field }) => (
                              <FormItem
                                layout="horizontal"
                                labelWidth="md"
                                alignment="center"
                              >
                                <FormLabel htmlFor="material-model-inspection-interval">
                                  {intl.formatMessage({
                                    id: 'materialModels.fields.inspectionInterval',
                                  })}
                                </FormLabel>
                                <FormControl>
                                  <InputSelect
                                    input={
                                      <Input
                                        {...field}
                                        id="material-model-inspection-interval"
                                        type="number"
                                        min={1}
                                        step={1}
                                        aria-label={intl.formatMessage({
                                          id: 'materialModels.fields.inspectionInterval',
                                        })}
                                        onChange={(event) =>
                                          field.onChange(
                                            event.target.value === ''
                                              ? ''
                                              : Number(event.target.value),
                                          )
                                        }
                                      />
                                    }
                                    select={
                                      <Select
                                        value={form.watch(
                                          'inspectionIntervalUnit',
                                        )}
                                        onValueChange={(value) => {
                                          if (
                                            value === 'day' ||
                                            value === 'month'
                                          ) {
                                            form.setValue(
                                              'inspectionIntervalUnit',
                                              value,
                                              { shouldDirty: true },
                                            );
                                          }
                                        }}
                                      >
                                        <SelectTrigger
                                          size="sm"
                                          aria-label={intl.formatMessage({
                                            id: 'materialModels.fields.inspectionIntervalUnit',
                                          })}
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
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="skipInitialInspection"
                            render={({ field }) => (
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
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                    aria-label={intl.formatMessage({
                                      id: 'materialModels.fields.skipInitialInspection',
                                    })}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </>
                      ) : null}
                    </div>
                  </Form>
                </CardContent>
              </Card>
              {requiresInspection ? (
                <SafetyInspectionChecklistEditor
                  groups={inspectionChecklist}
                  onChange={(groups) =>
                    form.setValue('safetyInspectionChecklist', groups, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              ) : null}
            </TabsContent>
          </Tabs>
        </form>
      )}
    </div>
  );
}

function countFormErrors(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const error = value as Record<string, unknown>;
  if (typeof error.message === 'string' || error.type) return 1;
  return Object.entries(error).reduce(
    (count, [key, item]) =>
      count + (key === 'ref' || key === 'types' ? 0 : countFormErrors(item)),
    0,
  );
}

function FormTabErrorBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="destructive"
          size="xs"
          shape="circle"
          className="size-4 min-w-4 p-0.5"
          tabIndex={0}
          aria-label={`Tab có ${count} lỗi`}
        >
          <span className="text-xs font-bold leading-none text-destructive-foreground!">
            !
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent variant="destructive">
        Có {count} lỗi cần kiểm tra
      </TooltipContent>
    </Tooltip>
  );
}
