import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import { useMaterialModelsQuery } from '@/project/material-models/hooks/use-material-models';
import { Boxes, Save } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Textarea } from '@/components/ui/textarea';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { MaterialModelImageView } from '../components/material-model-image';
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
  const imageOverride = form.watch('imageUrlOverride');
  const previousModelId = useRef('');
  const currentModel = modelsQuery.data?.find(
    (model) =>
      model.id === (isEdit ? editingMaterial?.modelId : selectedModelId),
  );
  const snapshot = isEdit ? editingMaterial?.modelSnapshot : currentModel;

  useEffect(() => {
    if (isEdit && editingMaterial) {
      form.reset(mapMaterialToForm(editingMaterial));
      previousModelId.current = editingMaterial.modelId;
    } else if (!isEdit) {
      form.reset(materialDefaultValues);
      previousModelId.current = '';
    }
  }, [editingMaterial, form, isEdit]);

  useEffect(() => {
    if (
      !isEdit &&
      selectedModelId &&
      previousModelId.current !== selectedModelId
    ) {
      previousModelId.current = selectedModelId;
      form.setValue('specificationOverrides', {}, { shouldDirty: true });
    }
  }, [form, isEdit, selectedModelId]);

  const modelIdOptions = useMemo(
    () =>
      (modelsQuery.data ?? [])
        .filter(
          (model) => model.isActive || model.id === editingMaterial?.modelId,
        )
        .map((model) => ({
          value: model.id,
          label: `${model.code} · ${model.name}`,
        })),
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
          <>
            <Button type="button" variant="outline" size="md" onClick={back}>
              {intl.formatMessage({ id: 'project.materials.actions.cancel' })}
            </Button>
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
          </>
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
    const payload: MaterialFormValues = {
      ...values,
      condition: values.condition as MaterialCondition,
    };
    saveMutation.mutate(
      {
        id: isEdit ? id : null,
        expectedVersion: isEdit ? editingMaterial!.version : null,
        values: payload,
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-y-auto p-4 lg:p-5">
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
        <Card
          className="min-h-80 flex-1 animate-pulse"
          aria-label={intl.formatMessage({
            id: 'project.materials.states.loading',
          })}
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
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isEdit ? (
            <div className="mb-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              <span className="font-medium">
                {intl.formatMessage({ id: 'project.materials.fields.code' })}
                :{' '}
              </span>
              {editingMaterial?.code}
            </div>
          ) : null}
          <MaterialForm
            id={FORM_ID}
            mode={isEdit ? 'edit' : 'create'}
            form={form}
            onSubmit={handleSubmit}
            modelIdOptions={modelIdOptions}
            ownerPartyIdOptions={ownerPartyIdOptions}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {intl.formatMessage({ id: 'project.materials.form.imageUrlOnly' })}
          </p>
          {!isEdit && ownerPartyIdOptions.length === 0 ? (
            <Card className="mt-4 border-warning/40 bg-warning/5">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm">
                  {intl.formatMessage({
                    id: 'project.materials.form.noRepresentedOwner',
                  })}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(ROUTES.PROJECT.CUSTODIANS)}
                >
                  {intl.formatMessage({
                    id: 'project.materials.actions.manageCustodians',
                  })}
                </Button>
              </CardContent>
            </Card>
          ) : null}
          {snapshot ? (
            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
              <Card>
                <CardHeader>
                  <CardHeading>
                    <CardTitle>
                      {intl.formatMessage({
                        id: 'project.materials.sections.modelSnapshot',
                      })}
                    </CardTitle>
                    <CardDescription>
                      {snapshot.code} · {snapshot.name}
                    </CardDescription>
                  </CardHeading>
                </CardHeader>
                <CardContent className="space-y-5">
                  <SpecificationOverrides
                    specifications={snapshot.specifications}
                    values={form.watch('specificationOverrides') ?? {}}
                    onChange={(next) =>
                      form.setValue('specificationOverrides', next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    intl={intl}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardHeading>
                    <CardTitle>
                      {intl.formatMessage({
                        id: 'project.materials.fields.image',
                      })}
                    </CardTitle>
                  </CardHeading>
                </CardHeader>
                <CardContent className="space-y-3">
                  <MaterialModelImageView
                    image={snapshot.images[0]}
                    alt={snapshot.name}
                    className="max-h-64 w-full rounded-lg bg-muted object-contain"
                  />
                  {snapshot.description ? (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {snapshot.description}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="mt-5">
              <CardHeader>
                <CardHeading>
                  <CardTitle>
                    {intl.formatMessage({
                      id: 'project.materials.sections.modelSnapshot',
                    })}
                  </CardTitle>
                  <CardDescription>
                    {intl.formatMessage({
                      id: 'project.materials.form.chooseModelHint',
                    })}
                  </CardDescription>
                </CardHeading>
              </CardHeader>
            </Card>
          )}
          {imageOverride ? (
            <Card className="mt-5 max-w-xl">
              <CardHeader>
                <CardHeading>
                  <CardTitle>
                    {intl.formatMessage({
                      id: 'project.materials.fields.imagePreview',
                    })}
                  </CardTitle>
                </CardHeading>
              </CardHeader>
              <CardContent className="space-y-3">
                <img
                  src={imageOverride}
                  alt={intl.formatMessage({
                    id: 'project.materials.fields.imagePreview',
                  })}
                  className="max-h-64 w-full rounded-lg bg-muted object-contain"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    form.setValue('imageUrlOverride', '', { shouldDirty: true })
                  }
                >
                  {intl.formatMessage({
                    id: 'project.materials.actions.resetImage',
                  })}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
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
    imageUrlOverride: material.imageUrlOverride ?? '',
    serialNumber: material.serialNumber ?? '',
    ownerPartyId: material.ownerPartyId,
    condition: material.condition,
    conditionNote: material.conditionNote ?? '',
    specificationOverrides: material.specificationOverrides,
  };
}

function SpecificationOverrides({
  specifications,
  values,
  onChange,
  intl,
}: {
  specifications: Material['modelSnapshot']['specifications'];
  values: Record<string, string[]>;
  onChange: (values: Record<string, string[]>) => void;
  intl: ReturnType<typeof useIntl>;
}) {
  const [editingIds, setEditingIds] = useState<Set<string>>(
    () => new Set(Object.keys(values)),
  );
  useEffect(() => {
    const resolved = new Set(specifications.map((item) => item.id));
    setEditingIds(
      (current) =>
        new Set(
          [...current].filter(
            (key) =>
              resolved.has(key) ||
              Object.prototype.hasOwnProperty.call(values, key),
          ),
        ),
    );
  }, [specifications, values]);
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">
        {intl.formatMessage({ id: 'project.materials.fields.specifications' })}
      </h2>
      {specifications.map((specification) => {
        const isCustom = Object.prototype.hasOwnProperty.call(
          values,
          specification.id,
        );
        const value = isCustom
          ? values[specification.id]
          : specification.values;
        const editing = editingIds.has(specification.id) || isCustom;
        return (
          <div
            key={specification.id}
            className="grid gap-2 border-b pb-3 sm:grid-cols-[minmax(160px,0.7fr)_minmax(0,1.3fr)] sm:items-center"
          >
            <div>
              <div className="text-sm font-medium">{specification.name}</div>
              <div className="text-xs text-muted-foreground">
                {specification.dataType}
              </div>
            </div>
            {editing ? (
              <div className="space-y-1.5">
                <Textarea
                  aria-label={specification.name}
                  value={value.join('\n')}
                  rows={Math.min(Math.max(value.length, 1), 4)}
                  onChange={(event) =>
                    onChange({
                      ...values,
                      [specification.id]: event.target.value.split('\n'),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = { ...values };
                    delete next[specification.id];
                    onChange(next);
                    setEditingIds((current) => {
                      const copy = new Set(current);
                      copy.delete(specification.id);
                      return copy;
                    });
                  }}
                >
                  {intl.formatMessage({
                    id: 'project.materials.actions.useModelValue',
                  })}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="whitespace-pre-wrap text-sm">
                  {value.join(', ')}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onChange({
                      ...values,
                      [specification.id]: [...specification.values],
                    });
                    setEditingIds((current) =>
                      new Set(current).add(specification.id),
                    );
                  }}
                >
                  {intl.formatMessage({
                    id: 'project.materials.actions.customize',
                  })}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
