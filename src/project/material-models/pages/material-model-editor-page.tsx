import { useEffect } from 'react';
import { ROUTES } from '@/constants/routes';
import { Boxes, Save } from 'lucide-react';
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
import { PageHeader } from '@/components/ui/page-header';
import {
  mapMaterialModelToFormValues,
  MaterialModelForm,
  useMaterialModelForm,
} from '../forms/material-model-form.generated';
import {
  useCreateMaterialModelMutation,
  useMaterialModelsQuery,
  useUpdateMaterialModelMutation,
} from '../hooks/use-material-models';
import type { MaterialModelFormValues } from '../model/material-model';
import { MATERIAL_MODEL_PERMISSION_CODES } from '../model/material-model-permissions';

export function MaterialModelEditorPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_MODEL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_MODEL_PERMISSION_CODES.manage);
  const query = useMaterialModelsQuery(
    isEdit && (isPermissionsPending || canView),
  );
  const createMutation = useCreateMaterialModelMutation();
  const updateMutation = useUpdateMaterialModelMutation();
  const form = useMaterialModelForm();
  const editingModel = id
    ? (query.data?.find((model) => model.id === id) ?? null)
    : null;

  useEffect(() => {
    if (editingModel) form.reset(mapMaterialModelToFormValues(editingModel));
  }, [editingModel, form]);

  const handleSubmit = (values: MaterialModelFormValues) => {
    if (!canManage) return;
    if (isEdit && id) {
      updateMutation.mutate(
        { id, values },
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
    createMutation.mutate(values, {
      onSuccess: () => {
        toast.success(
          intl.formatMessage({ id: 'materialModels.toasts.created' }),
        );
        navigate(ROUTES.PROJECT.MATERIAL_MODELS);
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    });
  };

  const isLoading =
    isPermissionsPending || (isEdit && canView && query.isPending);
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const title = intl.formatMessage({
    id: isEdit
      ? 'materialModels.dialogs.editTitle'
      : 'materialModels.dialogs.createTitle',
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={title}
        icon={Boxes}
        showBackButton
        backLabel={intl.formatMessage({ id: 'materialModels.actions.back' })}
        onBack={() => navigate(ROUTES.PROJECT.MATERIAL_MODELS)}
        actions={
          canManage && (!isEdit || editingModel) ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => navigate(ROUTES.PROJECT.MATERIAL_MODELS)}
              >
                {intl.formatMessage({ id: 'common.actions.cancel' })}
              </Button>
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
            </>
          ) : null
        }
      />

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
        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardContent className="min-h-0 overflow-y-auto">
            <MaterialModelForm
              form={form}
              onSubmit={handleSubmit}
              id="materialModel-form"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
