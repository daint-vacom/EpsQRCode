import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ROUTES } from '@/constants/routes';
import { MaterialSelectionDialog } from '@/project/materials/components/material-selection-dialog';
import { useMaterialsByIdsQuery } from '@/project/materials/hooks/use-materials';
import type { Material } from '@/project/materials/model/material';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/inputs/search-input';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/ui/loading';
import { SelectOptionContent } from '@/components/ui/select-option-content';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { MaterialLabelTemplateSelect } from '../components/material-label-template-select';
import {
  useMaterialLabelTemplatePreferencesQuery,
  useMaterialLabelTemplatesQuery,
  useSaveMaterialLabelTemplatePreferencesMutation,
} from '../hooks/use-material-label-templates';
import {
  MATERIAL_LABEL_BINDING_FIELDS,
  MATERIAL_LABEL_NOTE_BINDING,
  renderMaterialLabelSvg,
} from '../utils/material-label-design';
import {
  getMaterialLabelSelectionKey,
  MATERIAL_LABEL_SELECTION_STATE_KEY,
  readMaterialLabelSelection,
  storeMaterialLabelSelection,
} from '../utils/material-label-print-selection';
import './material-label-print.css';

export function MaterialLabelPrintPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const materialSelectionKey = getMaterialLabelSelectionKey(location.state);
  const [materialIds, setMaterialIds] = useState(() =>
    readMaterialLabelSelection(materialSelectionKey),
  );
  const materialIdsKey = materialIds.join(',');
  const updateMaterialSelection = useCallback(
    (nextIds: readonly string[]) => {
      const uniqueIds = [...new Set(nextIds.filter(Boolean))];
      const selectionKey = storeMaterialLabelSelection(
        uniqueIds,
        materialSelectionKey,
      );
      setMaterialIds(uniqueIds);
      navigate(location.pathname, {
        replace: true,
        state: { [MATERIAL_LABEL_SELECTION_STATE_KEY]: selectionKey },
      });
    },
    [location.pathname, materialSelectionKey, navigate],
  );
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
  const savePreferences = savePreferencesMutation.mutateAsync;
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [labelNotes, setLabelNotes] = useState<Record<string, string>>({});
  const [labelSvgs, setLabelSvgs] = useState<Record<string, string>>({});
  const [isMaterialSelectionOpen, setIsMaterialSelectionOpen] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialPageIndex, setMaterialPageIndex] = useState(0);
  const [previewListSize, setPreviewListSize] = useState({
    width: 0,
    height: 0,
    cardHeight: 0,
  });
  const previewListRef = useRef<HTMLDivElement>(null);
  const previewGridRef = useRef<HTMLDivElement>(null);
  const previewCardRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<unknown>(null);
  const [renderNonce, setRenderNonce] = useState(0);
  const materialDataKey = materialQueries
    .map((query) => query.dataUpdatedAt)
    .join(',');
  const materialQueriesRef = useRef(materialQueries);
  materialQueriesRef.current = materialQueries;
  const materials = useMemo(() => {
    const expectedCount = materialIdsKey ? materialIdsKey.split(',').length : 0;
    const queryMarkers = materialDataKey ? materialDataKey.split(',') : [];
    const currentQueries = materialQueriesRef.current;
    if (
      currentQueries.length !== expectedCount ||
      queryMarkers.length !== expectedCount
    ) {
      return [];
    }
    return currentQueries
      .map((query) => query.data)
      .filter((material): material is Material => Boolean(material));
  }, [materialDataKey, materialIdsKey]);
  const activeTemplates = useMemo(
    () => (templatesQuery.data ?? []).filter((template) => template.isActive),
    [templatesQuery.data],
  );
  const selectedTemplate = activeTemplates.find(
    (template) => template.id === selectedTemplateId,
  );
  const hasLabelNoteInput = useMemo(() => {
    const objects = selectedTemplate?.design?.objects;
    return (
      Array.isArray(objects) &&
      objects.some(
        (object) =>
          object !== null &&
          typeof object === 'object' &&
          Reflect.get(object, 'labelBinding') === MATERIAL_LABEL_NOTE_BINDING,
      )
    );
  }, [selectedTemplate]);
  const selectedTemplateFields = useMemo(() => {
    const objects = selectedTemplate?.design?.objects;
    if (!Array.isArray(objects)) return [];

    const seen = new Set<string>();
    const messageIds: string[] = [];
    objects.forEach((object) => {
      if (object === null || typeof object !== 'object') return;
      const binding = Reflect.get(object, 'labelBinding');
      if (typeof binding === 'string' && !seen.has(binding)) {
        const field = MATERIAL_LABEL_BINDING_FIELDS.find(
          (candidate) => candidate.key === binding,
        );
        if (field) {
          seen.add(binding);
          messageIds.push(field.messageId);
        }
      }
      if (
        (Reflect.get(object, 'labelElementType') === 'qr' ||
          Reflect.get(object, 'qrCode') === true) &&
        !seen.has('qrCode')
      ) {
        seen.add('qrCode');
        messageIds.push('project.materialLabels.materialFields.qrCode');
      }
    });

    return messageIds.map((id) => intl.formatMessage({ id }));
  }, [intl, selectedTemplate]);
  const filteredMaterials = useMemo(() => {
    const query = materialSearch.trim().toLocaleLowerCase();
    if (!query) return materials;
    return materials.filter((material) =>
      [
        material.code,
        material.nameOverride,
        material.modelSnapshot.code,
        material.modelSnapshot.name,
        material.serialNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [materialSearch, materials]);
  const materialCardColumns =
    previewListSize.width >= 1080 ? 3 : previewListSize.width >= 600 ? 2 : 1;
  const previewRows =
    previewListSize.height > 0 && previewListSize.cardHeight > 0
      ? Math.max(
          1,
          Math.floor(
            (previewListSize.height + 12) / (previewListSize.cardHeight + 12),
          ),
        )
      : 1;
  const materialPageSize = Math.max(1, materialCardColumns * previewRows);
  const materialPageCount = Math.max(
    1,
    Math.ceil(filteredMaterials.length / materialPageSize),
  );
  const currentMaterialPage = Math.min(
    materialPageIndex,
    materialPageCount - 1,
  );
  const visibleMaterials = filteredMaterials.slice(
    currentMaterialPage * materialPageSize,
    (currentMaterialPage + 1) * materialPageSize,
  );
  const firstVisibleMaterialId = visibleMaterials[0]?.id;

  useEffect(() => {
    const viewport = previewListRef.current;
    if (!viewport) return;
    const measure = () => {
      const next = {
        width: viewport.clientWidth,
        height: viewport.clientHeight,
        cardHeight: previewCardRef.current?.getBoundingClientRect().height ?? 0,
      };
      setPreviewListSize((current) =>
        current.width === next.width &&
        current.height === next.height &&
        current.cardHeight === next.cardHeight
          ? current
          : next,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    if (previewGridRef.current) observer.observe(previewGridRef.current);
    if (previewCardRef.current) observer.observe(previewCardRef.current);
    measure();
    return () => observer.disconnect();
  }, [firstVisibleMaterialId, hasLabelNoteInput, selectedTemplate?.id]);

  useEffect(() => {
    setMaterialIds(readMaterialLabelSelection(materialSelectionKey));
  }, [materialSelectionKey]);

  useEffect(() => {
    setMaterialPageIndex(0);
    const selectedIds = new Set(
      materialIdsKey ? materialIdsKey.split(',') : [],
    );
    setLabelNotes((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => selectedIds.has(id)),
      ),
    );
  }, [materialIdsKey]);

  useEffect(() => {
    setMaterialPageIndex(0);
  }, [materialSearch, materialPageSize]);

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
    if (!selectedTemplate || materials.length === 0) {
      setLabelSvgs({});
      setIsRendering(false);
      return;
    }
    let cancelled = false;
    setIsRendering(true);
    setLabelSvgs({});
    setRenderError(null);
    void Promise.all(
      materials.map(
        async (material) =>
          [
            material.id,
            await renderMaterialLabelSvg(
              selectedTemplate,
              material,
              labelNotes[material.id] ?? '',
            ),
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
  }, [labelNotes, materials, renderNonce, selectedTemplate]);

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
        (!selectedTemplateId &&
          materialIds.length > 0 &&
          preferencesQuery.isPending)));
  const printDisabled =
    !selectedTemplate ||
    materials.length === 0 ||
    isRendering ||
    Object.keys(labelSvgs).length !== materials.length ||
    savePreferencesMutation.isPending;

  const printLabels = useCallback(async () => {
    if (!selectedTemplate || materials.length === 0 || printDisabled) return;
    try {
      await savePreferences({
        materialIds: materials.map((material) => material.id),
        template: selectedTemplate,
        previews: labelSvgs,
      });
      toast.success(
        intl.formatMessage({
          id: 'project.materialLabels.toasts.preferenceSaved',
        }),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
      return;
    }
    window.print();
  }, [
    intl,
    labelSvgs,
    materials,
    printDisabled,
    savePreferences,
    selectedTemplate,
  ]);

  const header = useMemo(
    () => ({
      title: intl.formatMessage({
        id: 'project.materialLabels.page.printTitle',
      }),
      icon: Printer,
      showBackButton: true,
      backLabel: intl.formatMessage({
        id: 'project.materials.actions.back',
      }),
      onBack: () => navigate(ROUTES.PROJECT.MATERIALS),
    }),
    [intl, navigate],
  );
  useDetailEntryLayoutHeader(header);

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
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
          <PageLoading
            label={intl.formatMessage({
              id: 'common.state.loading',
            })}
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
          <div className="grid min-h-0 gap-4 lg:h-full lg:grid-cols-[minmax(19rem,25rem)_minmax(0,1fr)]">
            <Card className="flex min-h-0 flex-col">
              <CardContent className="flex flex-1 flex-col gap-5 p-4">
                <div className="flex items-center gap-3 rounded-lg border border-admin-primary-foam bg-admin-primary-foam/40 px-4 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-admin-primary text-white">
                    <Boxes className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {intl.formatMessage({
                        id: 'project.materialLabels.print.selectedMaterials',
                      })}
                    </p>
                    <p className="text-2xl font-semibold leading-tight text-admin-primary">
                      {materials.length}
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={intl.formatMessage({
                          id: 'project.materialLabels.actions.chooseMaterials',
                        })}
                        onClick={() => setIsMaterialSelectionOpen(true)}
                      >
                        <RefreshCw />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {intl.formatMessage({
                        id: 'project.materialLabels.actions.chooseMaterials',
                      })}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
                  <span className="text-sm font-medium">
                    {intl.formatMessage({
                      id: 'project.materialLabels.fields.template',
                    })}
                  </span>
                  <MaterialLabelTemplateSelect
                    ariaLabel={intl.formatMessage({
                      id: 'project.materialLabels.fields.template',
                    })}
                    value={selectedTemplateId}
                    sourceMode="options"
                    templates={activeTemplates}
                    onChange={setSelectedTemplateId}
                    disabled={activeTemplates.length === 0}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
                  <span className="text-sm font-medium">
                    {intl.formatMessage({
                      id: 'project.materialLabels.print.labelSize',
                    })}
                  </span>
                  <span className="text-sm text-foreground">
                    {selectedTemplate
                      ? `${selectedTemplate.widthMm} × ${selectedTemplate.heightMm} mm`
                      : '—'}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start">
                  <span className="pt-0.5 text-sm font-medium">
                    {intl.formatMessage({
                      id: 'project.materialLabels.print.displayedInformation',
                    })}
                  </span>
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {selectedTemplateFields.length > 0 ? (
                      selectedTemplateFields.map((field) => (
                        <Badge key={field} variant="secondary" size="md">
                          {field}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                {activeTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {intl.formatMessage({
                      id: 'project.materialLabels.errors.noActiveTemplate',
                    })}
                  </p>
                ) : null}
                {isRendering ? (
                  <p className="text-sm text-muted-foreground">
                    {intl.formatMessage({
                      id: 'project.materialLabels.states.rendering',
                    })}
                  </p>
                ) : null}
                <div className="mt-auto border-t pt-4">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    className="w-full"
                    disabled={printDisabled}
                    loading={savePreferencesMutation.isPending}
                    loadingText={intl.formatMessage({
                      id: 'project.materialLabels.actions.saving',
                    })}
                    onClick={() => void printLabels()}
                  >
                    <Printer />
                    {intl.formatMessage({
                      id: 'project.materialLabels.actions.startPrint',
                    })}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="flex min-h-[60vh] min-w-0 flex-col overflow-hidden lg:h-full">
              <CardHeader className="shrink-0 flex-row items-center gap-3 space-y-0">
                <SearchInput
                  aria-label={intl.formatMessage({
                    id: 'project.materialLabels.fields.searchMaterials',
                  })}
                  placeholder={intl.formatMessage({
                    id: 'project.materialLabels.fields.searchMaterials',
                  })}
                  value={materialSearch}
                  onSearch={setMaterialSearch}
                  className="min-w-0 flex-1"
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  {intl.formatMessage(
                    { id: 'project.materialLabels.print.filteredCount' },
                    { count: filteredMaterials.length },
                  )}
                </span>
              </CardHeader>
              <CardContent
                ref={previewListRef}
                className="min-h-0 flex-1 overflow-auto p-4"
              >
                {visibleMaterials.length > 0 ? (
                  <div
                    ref={previewGridRef}
                    className="grid gap-3"
                    style={{
                      gridTemplateColumns: `repeat(${materialCardColumns}, minmax(0, 1fr))`,
                    }}
                  >
                    {visibleMaterials.map((material, index) => {
                      const previewWidth = selectedTemplate?.widthMm ?? 60;
                      const previewHeight = selectedTemplate?.heightMm ?? 35;
                      const previewScale = Math.min(
                        280 / previewWidth,
                        144 / previewHeight,
                      );
                      return (
                        <Card
                          key={material.id}
                          ref={index === 0 ? previewCardRef : undefined}
                          className="min-w-0 overflow-hidden"
                        >
                          <CardHeader className="pb-2">
                            <div className="flex w-full min-w-0 items-center gap-2">
                              <SelectOptionContent
                                className="flex-1"
                                title={
                                  material.nameOverride?.trim() ||
                                  material.modelSnapshot.name
                                }
                                description={material.code}
                              />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    appearance="ghost"
                                    mode="icon"
                                    size="sm"
                                    aria-label={intl.formatMessage({
                                      id: 'project.materialLabels.actions.removeMaterialFromPrint',
                                    })}
                                    onClick={() =>
                                      updateMaterialSelection(
                                        materialIds.filter(
                                          (id) => id !== material.id,
                                        ),
                                      )
                                    }
                                  >
                                    <X />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {intl.formatMessage({
                                    id: 'project.materialLabels.actions.removeMaterialFromPrint',
                                  })}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </CardHeader>
                          <CardContent className="flex flex-col gap-3">
                            {hasLabelNoteInput ? (
                              <div className="grid gap-2">
                                <Label
                                  htmlFor={`material-label-note-${material.id}`}
                                >
                                  {intl.formatMessage({
                                    id: 'project.materialLabels.print.labelNote',
                                  })}
                                </Label>
                                <Input
                                  id={`material-label-note-${material.id}`}
                                  value={labelNotes[material.id] ?? ''}
                                  onChange={(event) =>
                                    setLabelNotes((current) => ({
                                      ...current,
                                      [material.id]: event.target.value,
                                    }))
                                  }
                                />
                              </div>
                            ) : null}
                            <div className="flex h-36 items-center justify-center overflow-hidden">
                              {labelSvgs[material.id] ? (
                                <div
                                  className="overflow-hidden border bg-white shadow-sm [&>svg]:block [&>svg]:size-full"
                                  style={{
                                    width: `${previewWidth * previewScale}px`,
                                    height: `${previewHeight * previewScale}px`,
                                  }}
                                  dangerouslySetInnerHTML={{
                                    __html: labelSvgs[material.id] ?? '',
                                  }}
                                />
                              ) : (
                                <Skeleton
                                  aria-hidden="true"
                                  className="rounded-sm"
                                  style={{
                                    width: `${previewWidth * previewScale}px`,
                                    height: `${previewHeight * previewScale}px`,
                                  }}
                                />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">
                    {intl.formatMessage({
                      id: materialSearch.trim()
                        ? 'project.materialLabels.empty.searchMaterials'
                        : 'project.materialLabels.empty.noMaterials',
                    })}
                  </div>
                )}
              </CardContent>
              <CardFooter className="shrink-0 justify-between gap-3 border-t">
                <span className="text-sm text-muted-foreground">
                  {intl.formatMessage(
                    { id: 'project.materialLabels.print.paginationInfo' },
                    {
                      from:
                        filteredMaterials.length > 0
                          ? currentMaterialPage * materialPageSize + 1
                          : 0,
                      to: Math.min(
                        (currentMaterialPage + 1) * materialPageSize,
                        filteredMaterials.length,
                      ),
                      count: filteredMaterials.length,
                    },
                  )}
                </span>
                {materialPageCount > 1 ? (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      mode="icon"
                      variant="ghost"
                      aria-label={intl.formatMessage({
                        id: 'project.materialLabels.actions.previousPage',
                      })}
                      disabled={currentMaterialPage === 0}
                      onClick={() =>
                        setMaterialPageIndex(currentMaterialPage - 1)
                      }
                    >
                      <ChevronLeft />
                    </Button>
                    <span className="min-w-12 text-center text-sm tabular-nums">
                      {currentMaterialPage + 1} / {materialPageCount}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      mode="icon"
                      variant="ghost"
                      aria-label={intl.formatMessage({
                        id: 'project.materialLabels.actions.nextPage',
                      })}
                      disabled={currentMaterialPage >= materialPageCount - 1}
                      onClick={() =>
                        setMaterialPageIndex(currentMaterialPage + 1)
                      }
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                ) : null}
              </CardFooter>
            </Card>
          </div>
        )}
      </div>

      <MaterialSelectionDialog
        open={isMaterialSelectionOpen}
        onOpenChange={setIsMaterialSelectionOpen}
        title={intl.formatMessage({
          id: 'project.materialLabels.actions.chooseMaterials',
        })}
        selectedMaterialIds={materialIds}
        selectionMode="multiple"
        onConfirm={updateMaterialSelection}
      />

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
