import { useId, useRef } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FabricObject } from 'fabric';
import {
  Circle as CircleIcon,
  Database,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  Layers3,
  Link2,
  LockKeyhole,
  LockKeyholeOpen,
  Minus,
  Plus,
  QrCode,
  RectangleHorizontal,
  Type,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MATERIAL_LABEL_FIELDS } from '../utils/material-label-design';
import type { MaterialLabelFieldKey } from '../utils/material-label-design';

interface MaterialLabelLayerPanelProps {
  layers: FabricObject[];
  selectedObject: FabricObject | null;
  canvasReady: boolean;
  hasQr: boolean;
  onAddText: () => void;
  onAddImage: (file: File) => void;
  onAddRectangle: () => void;
  onAddCircle: () => void;
  onAddLine: () => void;
  onAddQr: () => void;
  onAddField: (field: MaterialLabelFieldKey) => void;
  onSelectLayer: (object: FabricObject) => void;
  onToggleLock: (object: FabricObject) => void;
  onToggleVisibility: (object: FabricObject) => void;
  onReorder: (objects: FabricObject[]) => void;
}

function getLayerId(object: FabricObject) {
  return String(object.get('labelElementId') ?? '');
}

function getLayerName(
  object: FabricObject,
  formatMessage: ReturnType<typeof useIntl>['formatMessage'],
) {
  const customName = object.get('name');
  if (typeof customName === 'string' && customName.trim()) {
    return customName.trim();
  }

  const binding = object.get('labelBinding');
  const field = MATERIAL_LABEL_FIELDS.find((item) => item.key === binding);
  if (field) return formatMessage({ id: field.messageId });

  if (object.get('labelElementType') === 'qr' || object.get('qrCode')) {
    return formatMessage({ id: 'project.materialLabels.elements.qr' });
  }
  if (object.type === 'textbox' || object.type === 'text') {
    return formatMessage({ id: 'project.materialLabels.elements.staticText' });
  }
  if (object.type === 'image') {
    return formatMessage({ id: 'project.materialLabels.elements.image' });
  }
  if (object.type === 'circle') {
    return formatMessage({ id: 'project.materialLabels.elements.circle' });
  }
  if (object.type === 'line') {
    return formatMessage({ id: 'project.materialLabels.elements.line' });
  }
  return formatMessage({ id: 'project.materialLabels.elements.rectangle' });
}

function MaterialLabelLayerRow({
  object,
  selected,
  onSelect,
  onToggleLock,
  onToggleVisibility,
}: {
  object: FabricObject;
  selected: boolean;
  onSelect: () => void;
  onToggleLock: () => void;
  onToggleVisibility: () => void;
}) {
  const intl = useIntl();
  const id = getLayerId(object);
  const isLocked = object.get('editorLocked') === true;
  const isVisible = object.visible !== false;
  const isQr = object.get('labelElementType') === 'qr' || object.get('qrCode');
  const binding = object.get('labelBinding');
  const bindingField = MATERIAL_LABEL_FIELDS.find(
    (item) => item.key === binding,
  );
  const sortable = useSortable({ id, disabled: isLocked || !id });

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.55 : isVisible ? 1 : 0.62,
      }}
      className={`flex min-w-0 items-center gap-1 rounded-md border px-1 py-1 ${
        selected
          ? 'border-primary/30 bg-primary/5'
          : 'border-transparent hover:bg-muted/70'
      }`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        mode="icon"
        className="size-7 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        disabled={isLocked || !id}
        aria-label={intl.formatMessage({
          id: 'project.materialLabels.layers.reorder',
        })}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="md"
        className="min-w-0 flex-1 justify-start gap-2 px-1"
        aria-pressed={selected}
        onClick={onSelect}
      >
        {bindingField ? (
          <Database className="size-4 shrink-0 text-primary" />
        ) : isQr ? (
          <QrCode className="size-4 shrink-0 text-primary" />
        ) : object.type === 'image' ? (
          <ImagePlus className="size-4 shrink-0 text-muted-foreground" />
        ) : object.type === 'textbox' || object.type === 'text' ? (
          <Type className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <RectangleHorizontal className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate">
          {getLayerName(object, intl.formatMessage)}
        </span>
        {bindingField ? (
          <Link2
            className="size-3.5 shrink-0 text-primary"
            aria-label={intl.formatMessage({
              id: 'project.materialLabels.layers.dataBound',
            })}
          />
        ) : null}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        mode="icon"
        title={intl.formatMessage({
          id: isVisible
            ? 'project.materialLabels.layers.hide'
            : 'project.materialLabels.layers.show',
        })}
        aria-label={intl.formatMessage({
          id: isVisible
            ? 'project.materialLabels.layers.hide'
            : 'project.materialLabels.layers.show',
        })}
        disabled={isQr}
        onClick={onToggleVisibility}
      >
        {isVisible ? <Eye /> : <EyeOff />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        mode="icon"
        title={intl.formatMessage({
          id: isLocked
            ? 'project.materialLabels.layers.unlock'
            : 'project.materialLabels.layers.lock',
        })}
        aria-label={intl.formatMessage({
          id: isLocked
            ? 'project.materialLabels.layers.unlock'
            : 'project.materialLabels.layers.lock',
        })}
        onClick={onToggleLock}
      >
        {isLocked ? <LockKeyhole /> : <LockKeyholeOpen />}
      </Button>
    </div>
  );
}

export function MaterialLabelLayerPanel({
  layers,
  selectedObject,
  canvasReady,
  hasQr,
  onAddText,
  onAddImage,
  onAddRectangle,
  onAddCircle,
  onAddLine,
  onAddQr,
  onAddField,
  onSelectLayer,
  onToggleLock,
  onToggleVisibility,
  onReorder,
}: MaterialLabelLayerPanelProps) {
  const intl = useIntl();
  const inputId = useId();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = layers.findIndex((item) => getLayerId(item) === active.id);
    const newIndex = layers.findIndex((item) => getLayerId(item) === over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    onReorder(arrayMove(layers, oldIndex, newIndex));
  };

  const addButtons = [
    {
      id: 'text',
      labelId: 'project.materialLabels.actions.addText',
      Icon: Type,
      onClick: onAddText,
    },
    {
      id: 'image',
      labelId: 'project.materialLabels.actions.addImage',
      Icon: ImagePlus,
      onClick: () => imageInputRef.current?.click(),
    },
    {
      id: 'rectangle',
      labelId: 'project.materialLabels.actions.addRectangle',
      Icon: RectangleHorizontal,
      onClick: onAddRectangle,
    },
    {
      id: 'circle',
      labelId: 'project.materialLabels.actions.addCircle',
      Icon: CircleIcon,
      onClick: onAddCircle,
    },
    {
      id: 'line',
      labelId: 'project.materialLabels.actions.addLine',
      Icon: Minus,
      onClick: onAddLine,
    },
    {
      id: 'qr',
      labelId: 'project.materialLabels.actions.addQr',
      Icon: QrCode,
      onClick: onAddQr,
      disabled: hasQr,
    },
  ];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-3">
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {intl.formatMessage({
                id: 'project.materialLabels.layers.components',
              })}
            </h2>
            <Plus className="size-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {addButtons.map(({ id, labelId, Icon, onClick, disabled }) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                size="md"
                autoHeight
                className="min-h-16 flex-col gap-2 py-3"
                disabled={!canvasReady || disabled}
                onClick={onClick}
              >
                <Icon className="size-4 text-primary" />
                {intl.formatMessage({ id: labelId })}
              </Button>
            ))}
          </div>
          <input
            ref={imageInputRef}
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onAddImage(file);
              event.target.value = '';
            }}
          />
        </section>

        <section className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {intl.formatMessage({
                id: 'project.materialLabels.layers.materialData',
              })}
            </h2>
            <Database className="size-4 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            {MATERIAL_LABEL_FIELDS.filter((field) => field.kind === 'text').map(
              (field) => (
                <Button
                  key={field.key}
                  type="button"
                  variant="ghost"
                  size="md"
                  className="w-full justify-start gap-2"
                  disabled={!canvasReady}
                  onClick={() => onAddField(field.key)}
                >
                  <Plus className="size-4 text-primary" />
                  <span className="truncate">
                    {intl.formatMessage({ id: field.messageId })}
                  </span>
                </Button>
              ),
            )}
          </div>
        </section>

        <section className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {intl.formatMessage({
                id: 'project.materialLabels.layers.onLabel',
              })}
            </h2>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Layers3 className="size-4" />
              {layers.length}
            </div>
          </div>
          {layers.length ? (
            <DndContext
              id={`material-label-layers-${inputId}`}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              sensors={sensors}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={layers.map(getLayerId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {layers.map((object) => (
                    <MaterialLabelLayerRow
                      key={getLayerId(object)}
                      object={object}
                      selected={object === selectedObject}
                      onSelect={() => onSelectLayer(object)}
                      onToggleLock={() => onToggleLock(object)}
                      onToggleVisibility={() => onToggleVisibility(object)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              {intl.formatMessage({
                id: 'project.materialLabels.layers.empty',
              })}
            </p>
          )}
        </section>
      </div>
    </ScrollArea>
  );
}
