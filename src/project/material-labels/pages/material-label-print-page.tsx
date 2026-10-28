import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ROUTES } from '@/constants/routes';
import { useMaterialsByIdsQuery } from '@/project/materials/hooks/use-materials';
import type { Material } from '@/project/materials/model/material';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import { Printer, QrCode } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { OptionSelect } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import {
  useMaterialLabelTemplatePreferencesQuery,
  useMaterialLabelTemplatesQuery,
  useSaveMaterialLabelTemplatePreferencesMutation,
} from '../hooks/use-material-label-templates';
import { renderMaterialLabelSvg } from '../utils/material-label-design';
import './material-label-print.css';

function getMaterialIds(search: string): string[] {
  const raw = new URLSearchParams(search).get('ids') ?? '';
  return [
    ...new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

function getMaterialLabel(material: Material) {
  return `${material.code} · ${material.nameOverride?.trim() || material.modelSnapshot.name}`;
}

export function MaterialLabelPrintPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const materialIds = useMemo(
    () => getMaterialIds(location.search),
    [location.search],
  );
  const materialIdsKey = materialIds.join(',');
  const materialQueries = useMaterialsByIdsQuery(
    materialIds,
    canView && !isPermissionsPending,
  );
  const templatesQuery = useMaterialLabelTemplatesQuery(
    canView && !isPermissionsPending,
  );
  const preferencesQuery = useMaterialLabelTemplatePreferencesQuery(
    materialIds,
    canView && !isPermissionsPending,
  );
  const savePreferencesMutation =
    useSaveMaterialLabelTemplatePreferencesMutation();
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [labelSvgs, setLabelSvgs] = useState<Record<string, string>>({});
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<unknown>(null);
  const [renderNonce, setRenderNonce] = useState(0);
  const materialDataKey = materialQueries
    .map((query) => query.dataUpdatedAt)
    .join(',');

  const materialQueriesRef = useRef(materialQueries);
  materialQueriesRef.current = materialQueries;
  const materials = useMemo(() => {
    const updateMarkers = materialDataKey ? materialDataKey.split(',') : [];
    const currentQueries = materialQueriesRef.current;
    if (updateMarkers.length !== currentQueries.length) return [];
    return currentQueries
      .map((query) => query.data)
      .filter((material): material is Material => Boolean(material));
  }, [materialDataKey]);
  const activeTemplates = useMemo(
    () => (templatesQuery.data ?? []).filter((template) => template.isActive),
    [templatesQuery.data],
  );
  const selectedTemplate = activeTemplates.find(
    (template) => template.id === selectedTemplateId,
  );
  const templateOptions = activeTemplates.map((template) => ({
    value: template.id,
    label: `${template.name} · ${template.widthMm} × ${template.heightMm} mm`,
    searchableText: `${template.name} ${template.widthMm} ${template.heightMm}`,
  }));

  useEffect(() => {
    setSelectedTemplateId('');
  }, [materialIdsKey]);

  useEffect(() => {
    if (
      selectedTemplateId &&
      activeTemplates.some((item) => item.id === selectedTemplateId)
    ) {
      return;
    }
    if (activeTemplates.length === 0 || preferencesQuery.isPending) return;
    const preferenceByMaterial = new Map(
      (preferencesQuery.data ?? []).map((preference) => [
        preference.materialId,
        preference.templateId,
      ]),
    );
    const previousIds = materialIds.map((id) => preferenceByMaterial.get(id));
    const allPreviousMatch =
      previousIds.length > 0 &&
      previousIds.every((id) => id && id === previousIds[0]) &&
      activeTemplates.some((template) => template.id === previousIds[0]);
    const nextId = allPreviousMatch
      ? previousIds[0]!
      : (activeTemplates.find((template) => template.isDefault)?.id ??
        activeTemplates[0]?.id ??
        '');
    setSelectedTemplateId(nextId);
  }, [
    activeTemplates,
    materialIds,
    preferencesQuery.data,
    preferencesQuery.isPending,
    selectedTemplateId,
  ]);

  useEffect(() => {
    if (!selectedTemplate) {
      setLabelSvgs({});
      return;
    }
    if (materials.length === 0) return;
    let cancelled = false;
    setIsRendering(true);
    setRenderError(null);
    void Promise.all(
      materials.map(
        async (material) =>
          [
            material.id,
            await renderMaterialLabelSvg(selectedTemplate, material),
          ] as const,
      ),
    )
      .then((entries) => {
        if (!cancelled) setLabelSvgs(Object.fromEntries(entries));
      })
      .catch((error: unknown) => {
        if (!cancelled) setRenderError(error);
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [materials, renderNonce, selectedTemplate]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const style = document.createElement('style');
    style.dataset.materialLabelPrint = 'true';
    style.textContent = `@page { size: ${selectedTemplate.widthMm}mm ${selectedTemplate.heightMm}mm; margin: 0; }`;
    document.head.append(style);
    return () => style.remove();
  }, [selectedTemplate]);

  const materialError = materialQueries.find((query) => query.isError)?.error;
  const isLoading =
    isPermissionsPending ||
    (canView &&
      (materialQueries.some((query) => query.isPending) ||
        templatesQuery.isPending ||
        preferencesQuery.isPending));
  const printDisabled =
    !selectedTemplate ||
    materials.length === 0 ||
    isRendering ||
    Object.keys(labelSvgs).length !== materials.length ||
    savePreferencesMutation.isPending;

  const printLabels = async () => {
    if (!selectedTemplate || materials.length === 0 || printDisabled) return;
    try {
      await savePreferencesMutation.mutateAsync({
        materialIds: materials.map((material) => material.id),
        templateId: selectedTemplate.id,
      });
      toast.success(
        intl.formatMessage({
          id: 'project.materialLabels.toasts.preferenceSaved',
        }),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
    window.print();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({
          id: 'project.materialLabels.page.printTitle',
        })}
        icon={Printer}
        showBackButton
        backLabel={intl.formatMessage({ id: 'project.materials.actions.back' })}
        onBack={() => navigate(ROUTES.PROJECT.MATERIALS)}
        actions={
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={printDisabled}
            loading={savePreferencesMutation.isPending}
            loadingText={intl.formatMessage({
              id: 'project.materialLabels.actions.saving',
            })}
            onClick={() => void printLabels()}
          >
            <Printer />
            {intl.formatMessage({ id: 'project.materialLabels.actions.print' })}
          </Button>
        }
      />

      <div className="material-label-screen-controls min-h-0 flex-1 overflow-auto">
        {!isPermissionsPending && !canView ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materialLabels.errors.permission',
            })}
            description={intl.formatMessage({
              id: 'project.materialLabels.errors.permission',
            })}
          />
        ) : materialIds.length === 0 ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materialLabels.errors.noMaterial',
            })}
            description={intl.formatMessage({
              id: 'project.materialLabels.errors.noMaterial',
            })}
          />
        ) : materialError ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materialLabels.errors.loadTitle',
            })}
            description={getApiErrorMessage(materialError)}
            onRetry={() =>
              materialQueries.forEach((query) => void query.refetch())
            }
          />
        ) : templatesQuery.isError || preferencesQuery.isError ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materialLabels.errors.loadTitle',
            })}
            description={getApiErrorMessage(
              templatesQuery.error ?? preferencesQuery.error,
            )}
            onRetry={() => {
              void templatesQuery.refetch();
              void preferencesQuery.refetch();
            }}
          />
        ) : isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {intl.formatMessage({
              id: 'project.materialLabels.states.loading',
            })}
          </div>
        ) : activeTemplates.length === 0 ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materialLabels.errors.noActiveTemplate',
            })}
            description={intl.formatMessage({
              id: 'project.materialLabels.errors.noActiveTemplate',
            })}
            onRetry={() => void templatesQuery.refetch()}
          />
        ) : renderError ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materialLabels.errors.loadTitle',
            })}
            description={getApiErrorMessage(renderError)}
            onRetry={() => setRenderNonce((current) => current + 1)}
          />
        ) : (
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {intl.formatMessage({
                    id: 'project.materialLabels.page.printDescription',
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
                  <span className="text-sm font-medium">
                    {intl.formatMessage({
                      id: 'project.materialLabels.fields.template',
                    })}
                  </span>
                  <OptionSelect
                    ariaLabel={intl.formatMessage({
                      id: 'project.materialLabels.fields.template',
                    })}
                    value={selectedTemplateId}
                    options={templateOptions}
                    onChange={setSelectedTemplateId}
                    searchable={false}
                    canDeselect={false}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <QrCode className="size-4" aria-hidden="true" />
                  {intl.formatMessage(
                    { id: 'project.materialLabels.print.materialCount' },
                    { count: materials.length },
                  )}
                </div>
                {isRendering ? (
                  <p className="text-sm text-muted-foreground">
                    {intl.formatMessage({
                      id: 'project.materialLabels.states.rendering',
                    })}
                  </p>
                ) : null}
              </CardContent>
            </Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {materials.map((material) => (
                <Card key={material.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="truncate text-sm">
                      {getMaterialLabel(material)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center pb-4">
                    {labelSvgs[material.id] ? (
                      <div
                        className="overflow-hidden border bg-white shadow-sm [&>svg]:block [&>svg]:size-full"
                        style={{
                          width: `${selectedTemplate?.widthMm ?? 60}mm`,
                          height: `${selectedTemplate?.heightMm ?? 35}mm`,
                        }}
                        dangerouslySetInnerHTML={{
                          __html: labelSvgs[material.id] ?? '',
                        }}
                      />
                    ) : (
                      <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
                        {intl.formatMessage({
                          id: 'project.materialLabels.states.rendering',
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedTemplate && labelSvgs && materials.length > 0 ? (
        <div
          className="material-label-print-document"
          style={
            {
              '--material-label-width': `${selectedTemplate.widthMm}mm`,
              '--material-label-height': `${selectedTemplate.heightMm}mm`,
            } as CSSProperties
          }
        >
          {materials.map((material) => (
            <div key={material.id} className="material-label-print-item">
              <div
                dangerouslySetInnerHTML={{
                  __html: labelSvgs[material.id] ?? '',
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
