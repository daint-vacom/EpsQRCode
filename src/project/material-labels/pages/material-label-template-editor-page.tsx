import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import type { Material } from '@/project/materials/model/material';
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
  Redo2,
  Save,
  Trash2,
  Undo2,
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
import { NumericInput } from '@/components/ui/inputs/numeric-input';
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
  applyMaterialLabelPreview,
  getMaterialBindingValue,
  LABEL_DEFAULT_HEIGHT_MM,
  LABEL_DEFAULT_WIDTH_MM,
  LABEL_EDITOR_PIXELS_PER_MM,
  LABEL_MAX_HEIGHT_MM,
  LABEL_MAX_WIDTH_MM,
  LABEL_MIN_HEIGHT_MM,
  LABEL_MIN_WIDTH_MM,
  loadMaterialLabelDesign,
  MATERIAL_LABEL_BINDING_FIELDS,
  MATERIAL_LABEL_FIELDS,
  MATERIAL_LABEL_NOTE_BINDING,
  normalizeMaterialLabelTextbox,
  serializeMaterialLabelDesign,
  type MaterialLabelFieldKey,
  type MaterialLabelMaterialFieldKey,
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
  const getFieldSample = useCallback(
    (fieldKey: MaterialLabelFieldKey) => {
      const field = MATERIAL_LABEL_BINDING_FIELDS.find(
        (item) => item.key === fieldKey,
      );
      if (!field) return '';
      if (field.key === 'serialNumber') return field.sample;
      if (field.key === MATERIAL_LABEL_NOTE_BINDING) {
        return intl.formatMessage({
          id: 'project.materialLabels.print.labelNote',
        });
      }
      return intl.formatMessage({ id: field.messageId });
    },
    [intl],
  );
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
  const labelCardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const historyReadyRef = useRef(false);
  const restoringHistoryRef = useRef(false);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(
    null,
  );
  const [layers, setLayers] = useState<FabricObject[]>([]);
  const [canvasReady, setCanvasReady] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(150);
  const [metadata, setMetadata] = useState<TemplateMetadata>({
    name: '',
    description: '',
    widthMm: LABEL_DEFAULT_WIDTH_MM,
    heightMm: LABEL_DEFAULT_HEIGHT_MM,
    isDefault: false,
    isActive: true,
  });
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const previewRequestRef = useRef(0);

  const refreshEditorState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSelectedObject(canvas.getActiveObject() ?? null);
    setLayers(canvas.getObjects().slice().reverse());
  }, []);

  const commitHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !historyReadyRef.current || restoringHistoryRef.current) {
      return;
    }
    const snapshot = JSON.stringify({
      width: canvas.getWidth(),
      height: canvas.getHeight(),
      design: serializeMaterialLabelDesign(canvas),
    });
    if (snapshot === historyRef.current[historyIndexRef.current]) return;

    const nextHistory = historyRef.current.slice(
      0,
      historyIndexRef.current + 1,
    );
    nextHistory.push(snapshot);
    if (nextHistory.length > 100) nextHistory.shift();
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    setHistoryRevision((revision) => revision + 1);
  }, []);

  const scheduleHistoryCommit = useCallback(() => {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      historyTimerRef.current = null;
      commitHistory();
    }, 300);
  }, [commitHistory]);

  const restoreHistorySnapshot = useCallback(
    async (index: number) => {
      const canvas = canvasRef.current;
      const serialized = historyRef.current[index];
      if (!canvas || !serialized || restoringHistoryRef.current) return;
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }

      const snapshot = JSON.parse(serialized) as {
        width: number;
        height: number;
        design: ReturnType<typeof serializeMaterialLabelDesign>;
      };
      restoringHistoryRef.current = true;
      try {
        canvas.discardActiveObject();
        await canvas.loadFromJSON(snapshot.design);
        canvas.setDimensions({
          width: snapshot.width,
          height: snapshot.height,
        });
        canvas.getObjects().forEach((object) => {
          normalizeMaterialLabelTextbox(object);
          object.setCoords();
        });
        const previewRequestId = ++previewRequestRef.current;
        await applyMaterialLabelPreview(
          canvas,
          previewMaterial,
          EDITOR_SAMPLE_MATERIAL_ID,
          () => previewRequestId === previewRequestRef.current,
        );
        canvas.requestRenderAll();
        historyIndexRef.current = index;
        setMetadata((current) => ({
          ...current,
          widthMm: snapshot.width / LABEL_EDITOR_PIXELS_PER_MM,
          heightMm: snapshot.height / LABEL_EDITOR_PIXELS_PER_MM,
        }));
        refreshEditorState();
        setHistoryRevision((revision) => revision + 1);
      } finally {
        restoringHistoryRef.current = false;
      }
    },
    [previewMaterial, refreshEditorState],
  );

  const handleUndo = useCallback(() => {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    commitHistory();
    if (historyIndexRef.current > 0) {
      void restoreHistorySnapshot(historyIndexRef.current - 1);
    }
  }, [commitHistory, restoreHistorySnapshot]);

  const handleRedo = useCallback(() => {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    commitHistory();
    if (historyIndexRef.current < historyRef.current.length - 1) {
      void restoreHistorySnapshot(historyIndexRef.current + 1);
    }
  }, [commitHistory, restoreHistorySnapshot]);

  useEffect(() => {
    const handleHistoryKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, [contenteditable="true"]'))
      ) {
        return;
      }
      const activeObject = canvasRef.current?.getActiveObject() as
        | (FabricObject & { isEditing?: boolean })
        | undefined;
      if (activeObject?.isEditing) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && event.shiftKey) {
        event.preventDefault();
        handleRedo();
      } else if (key === 'z') {
        event.preventDefault();
        handleUndo();
      } else if (key === 'y') {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleHistoryKeyDown);
    return () => window.removeEventListener('keydown', handleHistoryKeyDown);
  }, [handleRedo, handleUndo]);

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

    const initialWidthMm = template?.widthMm ?? LABEL_DEFAULT_WIDTH_MM;
    const initialHeightMm = template?.heightMm ?? LABEL_DEFAULT_HEIGHT_MM;
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
    historyReadyRef.current = false;
    canvas.on('selection:created', refreshEditorState);
    canvas.on('selection:updated', refreshEditorState);
    canvas.on('selection:cleared', refreshEditorState);
    canvas.on('object:added', refreshEditorState);
    canvas.on('object:removed', refreshEditorState);
    canvas.on('object:modified', refreshEditorState);
    canvas.on('object:added', commitHistory);
    canvas.on('object:removed', commitHistory);
    canvas.on('object:modified', commitHistory);
    canvas.on('text:changed', scheduleHistoryCommit);
    canvas.on('text:changed', ({ target }) => {
      if (target?.type === 'textbox') normalizeMaterialLabelTextbox(target);
    });

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
          const binding = object.get('labelBinding');
          if (
            typeof binding === 'string' &&
            binding &&
            (object.type === 'textbox' || object.type === 'text') &&
            typeof object.get('labelSampleValue') !== 'string'
          ) {
            object.set('labelSampleValue', String(object.get('text') ?? ''));
          }
          if (
            binding === 'coverImage' &&
            object.type === 'image' &&
            typeof object.get('labelSampleImageSrc') !== 'string'
          ) {
            object.set('labelSampleImageSrc', (object as FabricImage).getSrc());
          }
          object.set({
            originX: 'left',
            originY: 'top',
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
          normalizeMaterialLabelTextbox(object);
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
        await applyMaterialLabelPreview(
          canvas,
          null,
          EDITOR_SAMPLE_MATERIAL_ID,
        );
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        refreshEditorState();
        historyRef.current = [];
        historyIndexRef.current = -1;
        historyReadyRef.current = true;
        commitHistory();
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
      historyReadyRef.current = false;
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }
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
    commitHistory,
    scheduleHistoryCommit,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasReady) return;
    const requestId = ++previewRequestRef.current;
    void applyMaterialLabelPreview(
      canvas,
      previewMaterial,
      EDITOR_SAMPLE_MATERIAL_ID,
      () => requestId === previewRequestRef.current,
    ).then(() => {
      if (requestId === previewRequestRef.current) refreshEditorState();
    });
    return () => {
      if (requestId === previewRequestRef.current) {
        previewRequestRef.current += 1;
      }
    };
  }, [canvasReady, previewMaterial, previewRevision, refreshEditorState]);

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
    canvas.renderAll();
    commitHistory();
  }, [canvasReady, commitHistory, metadata.heightMm, metadata.widthMm]);

  const addCanvasObject = useCallback(
    (object: FabricObject, elementType: string, name = '') => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      object.set({
        originX: 'left',
        originY: 'top',
        labelElementId: `label-element-${crypto.randomUUID()}`,
        labelElementType: elementType,
        name,
        editorLocked: false,
        selectable: true,
        evented: true,
      });
      normalizeMaterialLabelTextbox(object);
      canvas.add(object);
      canvas.setActiveObject(object);
      canvas.requestRenderAll();
      setPreviewRevision((revision) => revision + 1);
      refreshEditorState();
    },
    [refreshEditorState],
  );

  const addField = useCallback(
    (fieldKey: MaterialLabelFieldKey) => {
      const canvas = canvasRef.current;
      const definition = MATERIAL_LABEL_BINDING_FIELDS.find(
        (item) => item.key === fieldKey,
      );
      if (!canvas || !definition) return;
      const sampleValue = getFieldSample(fieldKey);
      const previewValue =
        previewMaterial && definition.kind === 'text'
          ? getMaterialBindingValue(
              previewMaterial,
              fieldKey as MaterialLabelMaterialFieldKey,
            )
          : sampleValue;
      const textbox = new Textbox(getFieldSample(fieldKey), {
        left: Math.max(10, canvas.getWidth() * 0.42),
        top: Math.max(10, canvas.getHeight() * 0.35),
        width: Math.max(40, canvas.getWidth() * 0.5),
        fontFamily: 'Arial',
        fontSize: Math.max(10, Math.round(canvas.getHeight() * 0.12)),
        fill: '#111827',
      });
      textbox.set({
        labelBinding: fieldKey,
        labelSampleValue: sampleValue,
        text: previewValue,
      });
      addCanvasObject(textbox, 'text');
    },
    [addCanvasObject, getFieldSample, previewMaterial],
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
      getMaterialQrUrl(previewMaterial?.id ?? EDITOR_SAMPLE_MATERIAL_ID),
      { size: Math.min(canvas.getHeight() * 0.72, 110) },
    );
    qr.set({
      labelElementId: `label-element-${crypto.randomUUID()}`,
      labelElementType: 'qr',
      name: '',
      editorLocked: false,
    });
    setPreviewRevision((revision) => revision + 1);
    commitHistory();
    refreshEditorState();
  }, [commitHistory, intl, previewMaterial, refreshEditorState]);

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

  const toggleLayerLock = useCallback(
    (object: FabricObject) => {
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
      commitHistory();
    },
    [commitHistory],
  );

  const toggleLayerVisibility = useCallback(
    (object: FabricObject) => {
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
      commitHistory();
    },
    [commitHistory],
  );

  const reorderLayers = useCallback(
    (orderedLayers: FabricObject[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      orderedLayers
        .slice()
        .reverse()
        .forEach((object, index) => canvas.moveObjectTo(object, index));
      canvas.requestRenderAll();
      setLayers(canvas.getObjects().slice().reverse());
      commitHistory();
    },
    [commitHistory],
  );

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
      } else if (property === 'text' && selectedObject.get('labelBinding')) {
        const binding = selectedObject.get('labelBinding');
        const isMaterialTextBinding = MATERIAL_LABEL_FIELDS.some(
          (field) => field.key === binding && field.kind === 'text',
        );
        selectedObject.set('labelSampleValue', value);
        if (!previewMaterial || !isMaterialTextBinding) {
          selectedObject.set(property, value);
        }
      } else {
        selectedObject.set(property, value);
      }
      selectedObject.setCoords();
      canvas.requestRenderAll();
      setLayers(canvas.getObjects().slice().reverse());
      commitHistory();
    },
    [commitHistory, previewMaterial, selectedObject],
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
      if (selectedObject.type === 'textbox' && property === 'width') {
        selectedObject.set({
          width: Math.max(1, parsed * LABEL_EDITOR_PIXELS_PER_MM),
          scaleX: 1,
        });
        selectedObject.initDimensions();
      } else if (selectedObject.type === 'textbox' && property === 'height') {
        return;
      } else if (property === 'left' || property === 'top') {
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
      commitHistory();
    },
    [commitHistory, selectedObject],
  );

  const updateSelectedBinding = useCallback(
    (value: string) => {
      if (!selectedObject || selectedObject.get('editorLocked')) return;
      const fieldKey = value === '__static__' ? '' : value;
      selectedObject.set('labelBinding', fieldKey);
      const field = MATERIAL_LABEL_BINDING_FIELDS.find(
        (item) => item.key === fieldKey,
      );
      if (field?.kind === 'text') {
        const sampleValue = getFieldSample(fieldKey);
        selectedObject.set({
          labelSampleValue: sampleValue,
          text:
            previewMaterial &&
            field?.kind === 'text' &&
            fieldKey !== MATERIAL_LABEL_NOTE_BINDING
              ? getMaterialBindingValue(
                  previewMaterial,
                  fieldKey as MaterialLabelMaterialFieldKey,
                )
              : sampleValue,
        });
        normalizeMaterialLabelTextbox(selectedObject);
      } else if (field?.kind === 'image' && selectedObject.type === 'image') {
        selectedObject.set(
          'labelSampleImageSrc',
          (selectedObject as FabricImage).getSrc(),
        );
      }
      canvasRef.current?.requestRenderAll();
      if (canvasRef.current) {
        setLayers(canvasRef.current.getObjects().slice().reverse());
      }
      setPreviewRevision((revision) => revision + 1);
      commitHistory();
    },
    [commitHistory, getFieldSample, previewMaterial, selectedObject],
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
        normalizeMaterialLabelTextbox(clone);
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

  useEffect(() => {
    if (!selectedObject) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, [contenteditable="true"]'))
      ) {
        return;
      }

      if (
        selectedObject.get('editorLocked') ||
        selectedObject.get('labelElementType') === 'qr' ||
        (selectedObject as FabricObject & { isEditing?: boolean }).isEditing
      ) {
        return;
      }

      event.preventDefault();
      deleteSelectedObject();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelectedObject, selectedObject]);

  const centerSelectedObject = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedObject || selectedObject.get('editorLocked'))
      return;
    canvas.centerObject(selectedObject);
    selectedObject.setCoords();
    canvas.requestRenderAll();
    setLayers(canvas.getObjects().slice().reverse());
    commitHistory();
  }, [commitHistory, selectedObject]);

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
    const labelCard = labelCardRef.current;
    const canvas = canvasRef.current;
    if (!canvasReady || !labelCard || !canvas) return;
    labelCard.style.transform = `scale(${canvasScale})`;
    labelCard.style.transformOrigin = 'top left';
    canvas.calcOffset();
    canvas.renderAll();
  }, [canvasReady, canvasScale]);

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
                <CardHeader className="justify-between border-b px-4 py-2">
                  <div className="flex shrink-0 items-center gap-1">
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
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      mode="icon"
                      title={intl.formatMessage({
                        id: 'project.materialLabels.actions.undo',
                      })}
                      aria-label={intl.formatMessage({
                        id: 'project.materialLabels.actions.undo',
                      })}
                      disabled={
                        historyRevision === 0 || historyIndexRef.current <= 0
                      }
                      onClick={handleUndo}
                    >
                      <Undo2 />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      mode="icon"
                      title={intl.formatMessage({
                        id: 'project.materialLabels.actions.redo',
                      })}
                      aria-label={intl.formatMessage({
                        id: 'project.materialLabels.actions.redo',
                      })}
                      disabled={
                        historyRevision === 0 ||
                        historyIndexRef.current >= historyRef.current.length - 1
                      }
                      onClick={handleRedo}
                    >
                      <Redo2 />
                    </Button>
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
                          ref={labelCardRef}
                          className="absolute shrink-0 rounded-sm bg-white shadow-md ring-1 ring-border"
                          style={{
                            left: rulerGutterX,
                            top: rulerGutterY,
                            width: canvasWidth,
                            height: canvasHeight,
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
                  previewMaterial={previewMaterial}
                  onPreviewMaterialChange={(material) =>
                    setPreviewMaterial(material ?? null)
                  }
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
      <NumericInput
        autoFocus
        aria-label={label}
        className="w-20 text-center"
        min={1}
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
        step={0.1}
        decimalScale={1}
        inputMode="decimal"
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
