import { useEffect, useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useCodeGenerationPatternsQuery } from '@/project/code-generation/hooks/use-code-generation-patterns';
import { DEFAULT_CODE_GENERATION_PATTERNS } from '@/project/code-generation/model/code-pattern-example';
import { Boxes, Eye, Save } from 'lucide-react';
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
import { ErrorState } from '@/components/ui/error-state';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/ui/loading';
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
  const [galleryImages, setGalleryImages] = useState<MaterialModelImageDraft[]>(
    [],
  );
  const [publicDisplaySettings, setPublicDisplaySettings] =
    useState<MaterialPublicDisplaySettings>(
      DEFAULT_MATERIAL_PUBLIC_DISPLAY_SETTINGS,
    );
  const [activeTab, setActiveTab] = useState('general');
  const requiresInspection = form.watch('requiresInspection');
  const specificationCount = form.watch('specifications')?.length ?? 0;
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

  useEffect(() => {
    if (!requiresInspection && activeTab === 'inspection') {
      setActiveTab('general');
    }
  }, [activeTab, requiresInspection]);

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
    setActiveTab(errors.specifications ? 'technical' : 'general');
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
                {intl.formatMessage({ id: 'materialModels.tabs.general' })}
              </TabsTrigger>
              <TabsTrigger
                value="technical"
                count={specificationCount}
                afterCount={
                  <FormTabErrorBadge count={specificationErrorCount} />
                }
              >
                {intl.formatMessage({ id: 'materialModels.tabs.technical' })}
              </TabsTrigger>
              {requiresInspection && (
                <TabsTrigger value="inspection">
                  {intl.formatMessage({ id: 'materialModels.tabs.inspection' })}
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent
              value="general"
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain"
            >
              <Card className="min-w-0 shrink-0">
                <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-5">
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
                <CardContent className="flex flex-col gap-4 p-5 pt-1">
                  <div className="[--form-item-label-width:8.75rem] grid grid-cols-[var(--form-item-label-width)_minmax(0,1fr)] items-center gap-x-3">
                    <Label htmlFor="model-public-basic-info">
                      {intl.formatMessage({
                        id: 'project.materials.form.publicDisplay.basicInfo',
                      })}
                    </Label>
                    <Switch
                      id="model-public-basic-info"
                      checked={publicDisplaySettings.basicInfo}
                      onCheckedChange={(basicInfo) =>
                        setPublicDisplaySettings((current) => ({
                          ...current,
                          basicInfo,
                        }))
                      }
                    />
                  </div>
                  <div className="[--form-item-label-width:8.75rem] grid grid-cols-[var(--form-item-label-width)_minmax(0,1fr)] items-center gap-x-3">
                    <Label htmlFor="model-public-specifications">
                      {intl.formatMessage({
                        id: 'project.materials.form.publicDisplay.specifications',
                      })}
                    </Label>
                    <Switch
                      id="model-public-specifications"
                      checked={publicDisplaySettings.specifications}
                      disabled={!publicDisplaySettings.basicInfo}
                      onCheckedChange={(specifications) =>
                        setPublicDisplaySettings((current) => ({
                          ...current,
                          specifications,
                        }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent
              value="technical"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <Card className="min-h-[32rem] min-w-0 flex-1 flex-col overflow-hidden">
                <MaterialSpecificationsTable
                  mode="model"
                  form={form}
                  publicVisibilityDisabled={!publicDisplaySettings.basicInfo}
                />
              </Card>
            </TabsContent>
            {requiresInspection && (
              <TabsContent value="inspection" className="min-h-0 flex-1" />
            )}
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
