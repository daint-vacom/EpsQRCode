import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import { getMaterialQrUrl } from '@/project/materials/utils/material-qr';
import {
  Canvas,
  Circle,
  FabricImage,
  Line,
  Rect,
  Textbox,
  type FabricObject,
} from 'fabric';
import {
  AlignCenter,
  Copy,
  QrCode,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { PageLoading } from '@/components/ui/loading';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { MaterialLabelLayerPanel } from '../components/material-label-layer-panel';
import { MaterialLabelPropertiesPanel } from '../components/material-label-properties-panel';
import {
  useMaterialLabelTemplatesQuery,
  useSaveMaterialLabelTemplateMutation,
} from '../hooks/use-material-label-templates';
import {
  addQrImageToCanvas,
  LABEL_EDITOR_PIXELS_PER_MM,
  LABEL_MAX_HEIGHT_MM,
  LABEL_MAX_WIDTH_MM,
  LABEL_MIN_HEIGHT_MM,
  LABEL_MIN_WIDTH_MM,
  loadMaterialLabelDesign,
  MATERIAL_LABEL_FIELDS,
  serializeMaterialLabelDesign,
  type MaterialLabelFieldKey,
} from '../utils/material-label-design';

const EDITOR_SAMPLE_MATERIAL_ID = '00000000-0000-4000-8000-000000000001';

type TemplateMetadata = {
  name: string;
  description: string;
  widthMm: number;
  heightMm: number;
  isDefault: boolean;
  isActive: boolean;
};

export function MaterialLabelTemplateEditorPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id: templateId } = useParams();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const templatesQuery = useMaterialLabelTemplatesQuery(
    !isPermissionsPending && canManage,
  );
  const saveMutation = useSaveMaterialLabelTemplateMutation();
  const saveTemplate = saveMutation.mutateAsync;
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(
    null,
  );
  const [layers, setLayers] = useState<FabricObject[]>([]);
  const [canvasReady, setCanvasReady] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(150);
  const [metadata, setMetadata] = useState<TemplateMetadata>({
    name: '',
    description: '',
    widthMm: 60,
    heightMm: 35,
    isDefault: false,
    isActive: true,
  });

  const refreshEditorState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSelectedObject(canvas.getActiveObject() ?? null);
    setLayers(canvas.getObjects().slice().reverse());
  }, []);

  const templates = useMemo(
    () => templatesQuery.data ?? [],
    [templatesQuery.data],
  );
  const template = useMemo(
    () => templates.find((item) => item.id === templateId),
    [templateId, templates],
  );
  const isEditing = Boolean(templateId);
  const title = intl.formatMessage({
    id: isEditing
      ? 'project.materialLabels.page.editTitle'
      : 'project.materialLabels.page.createTitle',
  });
  useEffect(() => {
    if (!template) return;
    setMetadata({
      name: template.name,
      description: template.description ?? '',
      widthMm: template.widthMm,
      heightMm: template.heightMm,
      isDefault: template.isDefault,
      isActive: template.isActive,
    });
  }, [template]);

  useEffect(() => {
    if (
      !canvasElementRef.current ||
      isPermissionsPending ||
      !canManage ||
      templatesQuery.isPending ||
      (templateId && !template)
    ) {
      return;
    }
    if (canvasRef.current) return;

    const initialWidthMm = template?.widthMm ?? 60;
    const initialHeightMm = template?.heightMm ?? 35;
    const width = Math.round(initialWidthMm * LABEL_EDITOR_PIXELS_PER_MM);
    const height = Math.round(initialHeightMm * LABEL_EDITOR_PIXELS_PER_MM);
    const canvas = new Canvas(canvasElementRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
      stopContextMenu: true,
      renderOnAddRemove: true,
    });
    canvasRef.current = canvas;
    canvas.on('selection:created', refreshEditorState);
    canvas.on('selection:updated', refreshEditorState);
    canvas.on('selection:cleared', refreshEditorState);
    canvas.on('object:added', refreshEditorState);
    canvas.on('object:removed', refreshEditorState);
    canvas.on('object:modified', refreshEditorState);

    let cancelled = false;
    void loadMaterialLabelDesign(
      canvas,
      template?.design,
      initialWidthMm,
      initialHeightMm,
      EDITOR_SAMPLE_MATERIAL_ID,
    )
      .then(async () => {
        if (cancelled) return;
        canvas.getObjects().forEach((object, index) => {
          const isQr =
            object.get('labelElementType') === 'qr' ||
            object.get('qrCode') === true;
          const type =
            object.get('labelElementType') ||
            (isQr
              ? 'qr'
              : object.type === 'textbox' || object.type === 'text'
                ? 'text'
                : object.type === 'image'
                  ? 'image'
                  : object.type === 'line'
                    ? 'line'
                    : 'shape');
          const isLocked = object.get('editorLocked') === true;
          object.set({
            labelElementId:
              object.get('labelElementId') ||
              `label-layer-${index}-${crypto.randomUUID()}`,
            labelElementType: type,
            editorLocked: isLocked,
            selectable: !isLocked,
            evented: !isLocked,
            lockMovementX: isLocked,
            lockMovementY: isLocked,
            lockRotation: isLocked,
            lockScalingX: isLocked,
            lockScalingY: isLocked,
          });
        });
        const hasQr = canvas
          .getObjects()
          .some(
            (object) =>
              object.get('labelElementType') === 'qr' || object.get('qrCode'),
          );
        if (!hasQr) {
          await addQrImageToCanvas(
            canvas,
            getMaterialQrUrl(EDITOR_SAMPLE_MATERIAL_ID),
            { left: 12, top: 12, size: Math.min(height - 24, 96) },
          );
        }
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        refreshEditorState();
        setCanvasReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(
            intl.formatMessage({
              id: 'project.materialLabels.errors.loadTitle',
            }),
          );
        }
      });

    return () => {
      cancelled = true;
      canvasRef.current = null;
      void canvas.dispose();
    };
  }, [
    canManage,
    intl,
    isPermissionsPending,
    template,
    templateId,
    templatesQuery.isPending,
    refreshEditorState,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasReady) return;
    if (
      metadata.widthMm < LABEL_MIN_WIDTH_MM ||
      metadata.widthMm > LABEL_MAX_WIDTH_MM ||
      metadata.heightMm < LABEL_MIN_HEIGHT_MM ||
      metadata.heightMm > LABEL_MAX_HEIGHT_MM
    ) {
      return;
    }
    canvas.setDimensions({
      width: Math.round(metadata.widthMm * LABEL_EDITOR_PIXELS_PER_MM),
      height: Math.round(metadata.heightMm * LABEL_EDITOR_PIXELS_PER_MM),
    });
    canvas.requestRenderAll();
  }, [canvasReady, metadata.heightMm, metadata.widthMm]);

  const addCanvasObject = useCallback(
    (object: FabricObject, elementType: string, name = '') => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      object.set({
        labelElementId: `label-element-${crypto.randomUUID()}`,
        labelElementType: elementType,
        name,
        editorLocked: false,
        selectable: true,
        evented: true,
      });
      canvas.add(object);
      canvas.setActiveObject(object);
      canvas.requestRenderAll();
      refreshEditorState();
    },
    [refreshEditorState],
  );

  const addField = useCallback(
    (fieldKey: MaterialLabelFieldKey) => {
      const canvas = canvasRef.current;
      const definition = MATERIAL_LABEL_FIELDS.find(
        (item) => item.key === fieldKey,
      );
      if (!canvas || !definition) return;
      const textbox = new Textbox(definition.sample, {
        left: Math.max(10, canvas.getWidth() * 0.42),
        top: Math.max(10, canvas.getHeight() * 0.35),
        width: Math.max(40, canvas.getWidth() * 0.5),
        fontFamily: 'Arial',
        fontSize: Math.max(10, Math.round(canvas.getHeight() * 0.12)),
        fill: '#111827',
      });
      textbox.set({ labelBinding: fieldKey });
      addCanvasObject(textbox, 'text');
    },
    [addCanvasObject],
  );

  const addStaticText = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const textbox = new Textbox(
      intl.formatMessage({ id: 'project.materialLabels.defaults.newText' }),
      {
        left: Math.max(10, canvas.getWidth() * 0.4),
        top: Math.max(10, canvas.getHeight() * 0.65),
        width: Math.max(40, canvas.getWidth() * 0.5),
        fontFamily: 'Arial',
        fontSize: Math.max(10, Math.round(canvas.getHeight() * 0.1)),
        fill: '#111827',
      },
    );
    addCanvasObject(textbox, 'text');
  }, [addCanvasObject, intl]);

  const addRectangle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    addCanvasObject(
      new Rect({
        left: canvas.getWidth() * 0.35,
        top: canvas.getHeight() * 0.3,
        width: canvas.getWidth() * 0.3,
        height: canvas.getHeight() * 0.3,
        fill: '#eaf2ff',
        stroke: '#2563eb',
        strokeWidth: 2,
      }),
      'shape',
    );
  }, [addCanvasObject]);

  const addCircle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    addCanvasObject(
      new Circle({
        left: canvas.getWidth() * 0.4,
        top: canvas.getHeight() * 0.25,
        radius: Math.min(canvas.getWidth(), canvas.getHeight()) * 0.15,
        fill: '#eaf2ff',
        stroke: '#2563eb',
        strokeWidth: 2,
      }),
      'shape',
    );
  }, [addCanvasObject]);

  const addLine = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    addCanvasObject(
      new Line(
        [
          canvas.getWidth() * 0.25,
          canvas.getHeight() * 0.5,
          canvas.getWidth() * 0.75,
          canvas.getHeight() * 0.5,
        ],
        { stroke: '#2563eb', strokeWidth: 3 },
      ),
      'line',
    );
  }, [addCanvasObject]);

  const addImage = useCallback(
    (file: File) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (file.size > 2 * 1024 * 1024) {
        toast.error(
          intl.formatMessage({
            id: 'project.materialLabels.errors.imageTooLarge',
          }),
        );
        return;
      }
      const reader = new FileReader();
      reader.onerror = () =>
        toast.error(
          intl.formatMessage({
            id: 'project.materialLabels.errors.imageLoad',
          }),
        );
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        void FabricImage.fromURL(reader.result)
          .then((image) => {
            const activeCanvas = canvasRef.current;
            if (!activeCanvas) return;
            const maxWidth = activeCanvas.getWidth() * 0.42;
            const maxHeight = activeCanvas.getHeight() * 0.6;
            const scale = Math.min(
              1,
              maxWidth / Math.max(1, image.width ?? 1),
              maxHeight / Math.max(1, image.height ?? 1),
            );
            image.set({
              left: (activeCanvas.getWidth() - (image.width ?? 1) * scale) / 2,
              top: (activeCanvas.getHeight() - (image.height ?? 1) * scale) / 2,
              scaleX: scale,
              scaleY: scale,
            });
            addCanvasObject(image, 'image');
          })
          .catch(() =>
            toast.error(
              intl.formatMessage({
                id: 'project.materialLabels.errors.imageLoad',
              }),
            ),
          );
      };
      reader.readAsDataURL(file);
    },
    [addCanvasObject, intl],
  );

  const addQr = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentHasQr = canvas
      .getObjects()
      .some(
        (object) =>
          object.get('labelElementType') === 'qr' || object.get('qrCode'),
      );
    if (currentHasQr) {
      toast.error(
        intl.formatMessage({ id: 'project.materialLabels.errors.qrExists' }),
      );
      return;
    }
    const qr = await addQrImageToCanvas(
      canvas,
      getMaterialQrUrl(EDITOR_SAMPLE_MATERIAL_ID),
      { size: Math.min(canvas.getHeight() * 0.72, 110) },
    );
    qr.set({
      labelElementId: `label-element-${crypto.randomUUID()}`,
      labelElementType: 'qr',
      name: '',
      editorLocked: false,
    });
    refreshEditorState();
  }, [intl, refreshEditorState]);

  const selectLayer = useCallback(
    (object: FabricObject) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (object.get('editorLocked') === true) {
        canvas.discardActiveObject();
        setSelectedObject(object);
        setLayers(canvas.getObjects().slice().reverse());
        return;
      }
      canvas.setActiveObject(object);
      canvas.requestRenderAll();
      refreshEditorState();
    },
    [refreshEditorState],
  );

  const toggleLayerLock = useCallback((object: FabricObject) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const lock = object.get('editorLocked') !== true;
    object.set({
      editorLocked: lock,
      selectable: !lock,
      evented: !lock,
      lockMovementX: lock,
      lockMovementY: lock,
      lockRotation: lock,
      lockScalingX: lock,
      lockScalingY: lock,
    });
    if (lock) {
      canvas.discardActiveObject();
      setSelectedObject(object);
    } else {
      canvas.setActiveObject(object);
    }
    canvas.requestRenderAll();
    setLayers(canvas.getObjects().slice().reverse());
  }, []);

  const toggleLayerVisibility = useCallback((object: FabricObject) => {
    const canvas = canvasRef.current;
    if (!canvas || object.get('labelElementType') === 'qr') return;
    const visible = object.visible === false;
    object.set('visible', visible);
    if (!visible && canvas.getActiveObject() === object) {
      canvas.discardActiveObject();
      setSelectedObject(object);
    }
    canvas.requestRenderAll();
    setLayers(canvas.getObjects().slice().reverse());
  }, []);

  const reorderLayers = useCallback((orderedLayers: FabricObject[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    orderedLayers
      .slice()
      .reverse()
      .forEach((object, index) => canvas.moveObjectTo(object, index));
    canvas.requestRenderAll();
    setLayers(canvas.getObjects().slice().reverse());
  }, []);

  const updateSelectedObject = useCallback(
    (property: string, value: unknown) => {
      const canvas = canvasRef.current;
      if (
        !canvas ||
        !selectedObject ||
        (selectedObject.get('editorLocked') && property !== 'editorLocked')
      ) {
        return;
      }
      if (property === 'editorLocked') {
        const locked = value === true;
        selectedObject.set({
          editorLocked: locked,
          selectable: !locked,
          evented: !locked,
          lockMovementX: locked,
          lockMovementY: locked,
          lockRotation: locked,
          lockScalingX: locked,
          lockScalingY: locked,
        });
        if (locked) {
          canvas.discardActiveObject();
          setSelectedObject(selectedObject);
        } else {
          canvas.setActiveObject(selectedObject);
        }
      } else {
        selectedObject.set(property, value);
      }
      selectedObject.setCoords();
      canvas.requestRenderAll();
      setLayers(canvas.getObjects().slice().reverse());
    },
    [selectedObject],
  );

  const updateSelectedMeasurement = useCallback(
    (
      property: 'left' | 'top' | 'width' | 'height' | 'angle' | 'opacity',
      value: string,
    ) => {
      const canvas = canvasRef.current;
      const parsed = Number(value);
      if (
        !canvas ||
        !selectedObject ||
        selectedObject.get('editorLocked') ||
        !Number.isFinite(parsed)
      ) {
        return;
      }
      if (property === 'left' || property === 'top') {
        selectedObject.set(property, parsed * LABEL_EDITOR_PIXELS_PER_MM);
      } else if (property === 'width' || property === 'height') {
        const scaleProperty = property === 'width' ? 'scaleX' : 'scaleY';
        const baseSize = Math.max(1, Number(selectedObject.get(property)) || 1);
        selectedObject.set(
          scaleProperty,
          (parsed * LABEL_EDITOR_PIXELS_PER_MM) / baseSize,
        );
      } else if (property === 'opacity') {
        selectedObject.set(property, Math.max(0, Math.min(100, parsed)) / 100);
      } else {
        selectedObject.set(property, parsed);
      }
      selectedObject.setCoords();
      canvas.requestRenderAll();
      setLayers(canvas.getObjects().slice().reverse());
    },
    [selectedObject],
  );

  const updateSelectedBinding = useCallback(
    (value: string) => {
      if (!selectedObject || selectedObject.get('editorLocked')) return;
      const fieldKey = value === '__static__' ? '' : value;
      selectedObject.set('labelBinding', fieldKey);
      const field = MATERIAL_LABEL_FIELDS.find((item) => item.key === fieldKey);
      if (field) selectedObject.set('text', field.sample);
      canvasRef.current?.requestRenderAll();
      if (canvasRef.current) {
        setLayers(canvasRef.current.getObjects().slice().reverse());
      }
    },
    [selectedObject],
  );

  const duplicateSelectedObject = useCallback(() => {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      !selectedObject ||
      selectedObject.get('editorLocked') ||
      selectedObject.get('labelElementType') === 'qr'
    ) {
      return;
    }
    void selectedObject
      .clone([
        'labelElementId',
        'labelElementType',
        'labelBinding',
        'name',
        'editorLocked',
        'qrCode',
      ])
      .then((clone) => {
        clone.set({
          labelElementId: `label-element-${crypto.randomUUID()}`,
          left: Number(selectedObject.left ?? 0) + 12,
          top: Number(selectedObject.top ?? 0) + 12,
          name: '',
          editorLocked: false,
          selectable: true,
          evented: true,
          lockMovementX: false,
          lockMovementY: false,
          lockRotation: false,
          lockScalingX: false,
          lockScalingY: false,
        });
        canvas.add(clone);
        canvas.setActiveObject(clone);
        canvas.requestRenderAll();
        refreshEditorState();
      });
  }, [refreshEditorState, selectedObject]);

  const deleteSelectedObject = useCallback(() => {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      !selectedObject ||
      selectedObject.get('editorLocked') ||
      selectedObject.get('labelElementType') === 'qr'
    ) {
      return;
    }
    canvas.remove(selectedObject);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    refreshEditorState();
  }, [refreshEditorState, selectedObject]);

  const centerSelectedObject = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedObject || selectedObject.get('editorLocked'))
      return;
    canvas.centerObject(selectedObject);
    selectedObject.setCoords();
    canvas.requestRenderAll();
    setLayers(canvas.getObjects().slice().reverse());
  }, [selectedObject]);

  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canManage || !canvas || !canvasReady) return;
    if (!metadata.name.trim()) {
      toast.error(
        intl.formatMessage({
          id: 'project.materialLabels.errors.nameRequired',
        }),
      );
      return;
    }
    if (
      metadata.widthMm < LABEL_MIN_WIDTH_MM ||
      metadata.widthMm > LABEL_MAX_WIDTH_MM ||
      metadata.heightMm < LABEL_MIN_HEIGHT_MM ||
      metadata.heightMm > LABEL_MAX_HEIGHT_MM
    ) {
      toast.error(
        intl.formatMessage({ id: 'project.materialLabels.errors.sizeRange' }),
      );
      return;
    }
    try {
      await saveTemplate({
        id: templateId ?? null,
        name: metadata.name.trim(),
        description: metadata.description.trim(),
        widthMm: metadata.widthMm,
        heightMm: metadata.heightMm,
        design: serializeMaterialLabelDesign(canvas),
        isDefault: metadata.isDefault,
        isActive: metadata.isActive,
      });
      toast.success(
        intl.formatMessage({ id: 'project.materialLabels.toasts.saved' }),
      );
      navigate(ROUTES.PROJECT.MATERIAL_LABEL_TEMPLATES);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }, [
    canManage,
    canvasReady,
    intl,
    metadata,
    navigate,
    saveTemplate,
    templateId,
  ]);

  const header = useMemo(
    () => ({
      title,
      icon: QrCode,
      showBackButton: true,
      backLabel: intl.formatMessage({
        id: 'project.materialLabels.actions.cancel',
      }),
      onBack: () => navigate(ROUTES.PROJECT.MATERIAL_LABEL_TEMPLATES),
      actions:
        canManage && (!isEditing || template) ? (
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={saveMutation.isPending}
            loadingText={intl.formatMessage({
              id: 'project.materialLabels.actions.saving',
            })}
            disabled={!canvasReady}
            onClick={() => void handleSave()}
          >
            <Save />
            {intl.formatMessage({
              id: 'project.materialLabels.actions.save',
            })}
          </Button>
        ) : null,
    }),
    [
      canManage,
      canvasReady,
      handleSave,
      intl,
      isEditing,
      navigate,
      saveMutation.isPending,
      template,
      title,
    ],
  );
  useDetailEntryLayoutHeader(header);

  const isLoading =
    isPermissionsPending || (canManage && templatesQuery.isPending);
  const canvasWidth = Math.round(metadata.widthMm * LABEL_EDITOR_PIXELS_PER_MM);
  const canvasHeight = Math.round(
    metadata.heightMm * LABEL_EDITOR_PIXELS_PER_MM,
  );
  const canvasScale = zoomPercent / 100;
  const scaledCanvasWidth = canvasWidth * canvasScale;
  const scaledCanvasHeight = canvasHeight * canvasScale;
  const rulerGutterX = 84;
  const rulerGutterY = 44;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvasReady || !canvas) return;
    canvas.wrapperEl.style.transform = `scale(${canvasScale})`;
    canvas.wrapperEl.style.transformOrigin = 'top left';
  }, [canvasReady, canvasHeight, canvasScale, canvasWidth]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <div className="min-h-0 flex-1">
        {!isPermissionsPending && !canManage ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materialLabels.errors.permission',
            })}
            description={intl.formatMessage({
              id: 'project.materialLabels.errors.permission',
            })}
          />
        ) : templatesQuery.isError ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materialLabels.errors.loadTitle',
            })}
            description={getApiErrorMessage(templatesQuery.error)}
            onRetry={() => void templatesQuery.refetch()}
          />
        ) : isLoading ? (
          <PageLoading
            label={intl.formatMessage({
              id: 'project.materialLabels.states.loading',
            })}
          />
        ) : templateId && !template ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materialLabels.errors.notFound',
            })}
            description={intl.formatMessage({
              id: 'project.materialLabels.errors.notFound',
            })}
          />
        ) : (
          <div className="h-full min-h-0 overflow-auto">
            <div className="grid min-h-[560px] min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:h-full xl:grid-cols-[minmax(18rem,21rem)_minmax(0,1fr)_minmax(18rem,21rem)]">
              <Card className="h-[28rem] min-w-0 overflow-hidden md:col-start-1 md:row-start-1 xl:col-start-1 xl:row-start-1 xl:h-full">
                <MaterialLabelLayerPanel
                  layers={layers}
                  selectedObject={selectedObject}
                  canvasReady={canvasReady}
                  hasQr={layers.some(
                    (object) =>
                      object.get('labelElementType') === 'qr' ||
                      object.get('qrCode') === true,
                  )}
                  onAddText={addStaticText}
                  onAddImage={addImage}
                  onAddRectangle={addRectangle}
                  onAddCircle={addCircle}
                  onAddLine={addLine}
                  onAddQr={() => void addQr()}
                  onAddField={addField}
                  onSelectLayer={selectLayer}
                  onToggleLock={toggleLayerLock}
                  onToggleVisibility={toggleLayerVisibility}
                  onReorder={reorderLayers}
                />
              </Card>

              <Card className="h-[34rem] min-h-0 min-w-0 overflow-hidden md:col-span-2 md:row-start-2 xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:h-full">
                <CardHeader className="justify-end border-b px-4 py-2">
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      mode="icon"
                      title={intl.formatMessage({
                        id: 'project.materialLabels.actions.zoomOut',
                      })}
                      aria-label={intl.formatMessage({
                        id: 'project.materialLabels.actions.zoomOut',
                      })}
                      disabled={zoomPercent <= 60}
                      onClick={() =>
                        setZoomPercent((current) => Math.max(60, current - 10))
                      }
                    >
                      <ZoomOut />
                    </Button>
                    <span className="w-10 text-center text-sm tabular-nums text-muted-foreground">
                      {zoomPercent}%
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      mode="icon"
                      title={intl.formatMessage({
                        id: 'project.materialLabels.actions.zoomIn',
                      })}
                      aria-label={intl.formatMessage({
                        id: 'project.materialLabels.actions.zoomIn',
                      })}
                      disabled={zoomPercent >= 220}
                      onClick={() =>
                        setZoomPercent((current) => Math.min(220, current + 10))
                      }
                    >
                      <ZoomIn />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      mode="icon"
                      title={intl.formatMessage({
                        id: 'project.materialLabels.actions.centerElement',
                      })}
                      aria-label={intl.formatMessage({
                        id: 'project.materialLabels.actions.centerElement',
                      })}
                      disabled={
                        !selectedObject ||
                        selectedObject.get('editorLocked') === true
                      }
                      onClick={centerSelectedObject}
                    >
                      <AlignCenter />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      mode="icon"
                      title={intl.formatMessage({
                        id: 'project.materialLabels.actions.duplicateElement',
                      })}
                      aria-label={intl.formatMessage({
                        id: 'project.materialLabels.actions.duplicateElement',
                      })}
                      disabled={
                        !selectedObject ||
                        selectedObject.get('editorLocked') === true ||
                        selectedObject.get('labelElementType') === 'qr'
                      }
                      onClick={duplicateSelectedObject}
                    >
                      <Copy />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      mode="icon"
                      className="text-destructive"
                      title={intl.formatMessage({
                        id: 'project.materialLabels.actions.deleteElement',
                      })}
                      aria-label={intl.formatMessage({
                        id: 'project.materialLabels.actions.deleteElement',
                      })}
                      disabled={
                        !selectedObject ||
                        selectedObject.get('editorLocked') === true ||
                        selectedObject.get('labelElementType') === 'qr'
                      }
                      onClick={deleteSelectedObject}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="min-h-0 flex flex-1 flex-col overflow-hidden p-0">
                  <div className="min-h-0 flex-1 overflow-auto bg-muted/40">
                    <div className="flex h-max min-h-full w-max min-w-full items-center justify-center p-10">
                      <div
                        className="relative shrink-0"
                        style={{
                          width: scaledCanvasWidth + rulerGutterX * 2,
                          height: scaledCanvasHeight + rulerGutterY * 2,
                        }}
                      >
                        <div
                          className="absolute left-1/2 top-0 -translate-x-1/2"
                          style={{
                            left: rulerGutterX + scaledCanvasWidth / 2,
                            width: scaledCanvasWidth,
                            height: rulerGutterY,
                          }}
                        >
                          <div className="absolute inset-x-0 top-5 border-t border-amber-400" />
                          <span className="absolute left-0 top-3 h-3 border-s border-amber-400" />
                          <span className="absolute right-0 top-3 h-3 border-s border-amber-400" />
                          <div className="absolute inset-x-0 top-0 flex justify-center">
                            <DimensionRulerValue
                              value={metadata.widthMm}
                              label={intl.formatMessage({
                                id: 'project.materialLabels.fields.width',
                              })}
                              editHint={intl.formatMessage({
                                id: 'project.materialLabels.editor.dimensionEditHint',
                              })}
                              onCommit={(widthMm) =>
                                setMetadata((current) => ({
                                  ...current,
                                  widthMm,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div
                          className="absolute left-1/2 top-1/2 -translate-y-1/2"
                          style={{
                            left: rulerGutterX + scaledCanvasWidth + 16,
                            top: rulerGutterY + scaledCanvasHeight / 2,
                            height: scaledCanvasHeight,
                          }}
                        >
                          <div className="absolute inset-y-0 left-0 border-s border-amber-400" />
                          <span className="absolute left-[-5px] top-0 w-2.5 border-t border-amber-400" />
                          <span className="absolute bottom-0 left-[-5px] w-2.5 border-t border-amber-400" />
                          <div className="absolute left-4 top-1/2 -translate-y-1/2">
                            <DimensionRulerValue
                              value={metadata.heightMm}
                              label={intl.formatMessage({
                                id: 'project.materialLabels.fields.height',
                              })}
                              editHint={intl.formatMessage({
                                id: 'project.materialLabels.editor.dimensionEditHint',
                              })}
                              onCommit={(heightMm) =>
                                setMetadata((current) => ({
                                  ...current,
                                  heightMm,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div
                          className="absolute shrink-0 rounded-sm bg-white shadow-md ring-1 ring-border"
                          style={{
                            left: rulerGutterX,
                            top: rulerGutterY,
                            width: scaledCanvasWidth,
                            height: scaledCanvasHeight,
                          }}
                        >
                          <canvas
                            ref={canvasElementRef}
                            aria-label={intl.formatMessage({
                              id: 'project.materialLabels.page.title',
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="h-[28rem] min-w-0 overflow-hidden md:col-start-2 md:row-start-1 xl:col-start-3 xl:row-start-1 xl:h-full">
                <MaterialLabelPropertiesPanel
                  selectedObject={selectedObject}
                  metadata={metadata}
                  isEditing={isEditing}
                  onMetadataChange={(patch) =>
                    setMetadata((current) => ({ ...current, ...patch }))
                  }
                  onUpdateObject={updateSelectedObject}
                  onUpdateMeasurement={updateSelectedMeasurement}
                  onUpdateBinding={updateSelectedBinding}
                  onDuplicate={duplicateSelectedObject}
                  onDelete={deleteSelectedObject}
                  onCenter={centerSelectedObject}
                />
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type DimensionRulerValueProps = {
  value: number;
  label: string;
  editHint: string;
  onCommit: (value: number) => void;
};

function DimensionRulerValue({
  value,
  label,
  editHint,
  onCommit,
}: DimensionRulerValueProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const startEditing = () => {
    setDraft(String(value));
    setIsEditing(true);
  };

  const commit = () => {
    const nextValue = Number(draft);
    if (Number.isFinite(nextValue) && nextValue > 0) {
      onCommit(nextValue);
    }
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(String(value));
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Input
        autoFocus
        aria-label={label}
        className="w-20 text-center"
        min="1"
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            cancel();
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        step="0.1"
        type="number"
        value={draft}
        variant="sm"
      />
    );
  }

  return (
    <button
      aria-label={`${label}. ${editHint}`}
      className="cursor-text whitespace-nowrap rounded-sm px-1 text-sm font-medium text-amber-500 hover:bg-muted"
      onDoubleClick={startEditing}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          startEditing();
        }
      }}
      title={editHint}
      type="button"
    >
      {value.toLocaleString(undefined, { maximumFractionDigits: 1 })} mm
    </button>
  );
}
