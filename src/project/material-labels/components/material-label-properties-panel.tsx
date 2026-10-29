import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MaterialSelectionDialog } from '@/project/materials/components/material-selection-dialog';
import type { Material } from '@/project/materials/model/material';
import type { FabricObject } from 'fabric';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  Italic,
  LockKeyhole,
  LockKeyholeOpen,
  Trash2,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/inputs/numeric-input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SelectSearch } from '@/components/ui/select-search';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaterialIdentity } from '@/components/material-identity';
import {
  LABEL_EDITOR_PIXELS_PER_MM,
  MATERIAL_LABEL_BINDING_FIELDS,
  MATERIAL_LABEL_FIELDS,
} from '../utils/material-label-design';

export interface MaterialLabelTemplateEditorMetadata {
  name: string;
  description: string;
  widthMm: number;
  heightMm: number;
  isDefault: boolean;
  isActive: boolean;
}

type MaterialLabelPropertiesTab = 'design' | 'data' | 'template';

const FONT_FAMILY_OPTIONS = [
  'Arial',
  'Arial Black',
  'Arial Narrow',
  'Calibri',
  'Cambria',
  'Candara',
  'Comic Sans MS',
  'Consolas',
  'Courier New',
  'Georgia',
  'Inter',
  'Lato',
  'Lucida Console',
  'Montserrat',
  'Open Sans',
  'Roboto',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
].map((fontFamily) => ({ value: fontFamily, label: fontFamily }));

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[8.75rem_minmax(0,1fr)] items-center gap-3">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NumericDraftInput({
  value,
  onCommit,
  decimalScale = 1,
  ...props
}: {
  value: number;
  onCommit: (value: number) => void;
  decimalScale?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const pendingValueRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isEditing) setDraft(String(value));
  }, [isEditing, value]);

  const commit = () => {
    const pendingValue = pendingValueRef.current;
    pendingValueRef.current = undefined;
    setIsEditing(false);
    if (pendingValue !== undefined && Number.isFinite(pendingValue)) {
      setDraft(String(pendingValue));
      onCommit(pendingValue);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <NumericInput
      {...props}
      decimalScale={decimalScale}
      inputMode="decimal"
      value={isEditing ? draft : value}
      onFocus={() => {
        pendingValueRef.current = undefined;
        setDraft(String(value));
        setIsEditing(true);
      }}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onValueChange={(nextValue) => {
        if (isEditing) pendingValueRef.current = nextValue;
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          pendingValueRef.current = undefined;
          setDraft(String(value));
          setIsEditing(false);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function getBindingOptions(component: FabricObject) {
  if (component.type === 'textbox' || component.type === 'text') {
    return MATERIAL_LABEL_BINDING_FIELDS.filter(
      (field) => field.kind === 'text',
    );
  }
  if (component.type === 'image') {
    return MATERIAL_LABEL_FIELDS.filter((field) => field.kind === 'image');
  }
  return [];
}

export function MaterialLabelPropertiesPanel({
  selectedObject,
  metadata,
  isEditing,
  onMetadataChange,
  onUpdateObject,
  onUpdateMeasurement,
  onUpdateBinding,
  previewMaterial,
  onPreviewMaterialChange,
  onDuplicate,
  onDelete,
  onCenter,
}: {
  selectedObject: FabricObject | null;
  metadata: MaterialLabelTemplateEditorMetadata;
  isEditing: boolean;
  onMetadataChange: (
    patch: Partial<MaterialLabelTemplateEditorMetadata>,
  ) => void;
  onUpdateObject: (property: string, value: unknown) => void;
  onUpdateMeasurement: (
    property: 'left' | 'top' | 'width' | 'height' | 'angle' | 'opacity',
    value: string,
  ) => void;
  onUpdateBinding: (value: string) => void;
  previewMaterial: Material | null;
  onPreviewMaterialChange: (material: Material | undefined) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCenter: () => void;
}) {
  const intl = useIntl();
  const hasSelectedObject = selectedObject !== null;
  const [activeTab, setActiveTab] =
    useState<MaterialLabelPropertiesTab>('data');
  const [isPreviewMaterialDialogOpen, setIsPreviewMaterialDialogOpen] =
    useState(false);
  useEffect(() => {
    setActiveTab((currentTab) => {
      if (!hasSelectedObject && currentTab === 'design') return 'data';
      return hasSelectedObject && currentTab === 'template'
        ? 'design'
        : currentTab;
    });
  }, [hasSelectedObject]);
  const isQr =
    selectedObject?.get('labelElementType') === 'qr' ||
    selectedObject?.get('qrCode') === true;
  const isText =
    selectedObject?.type === 'textbox' || selectedObject?.type === 'text';
  const isImage = selectedObject?.type === 'image' && !isQr;
  const isShape = Boolean(selectedObject && !isText && !isImage && !isQr);
  const colorProperty = selectedObject?.type === 'line' ? 'stroke' : 'fill';
  const isLocked = selectedObject?.get('editorLocked') === true;
  const bindings = selectedObject ? getBindingOptions(selectedObject) : [];
  const selectedBinding = String(selectedObject?.get('labelBinding') ?? '');
  const selectedFontFamily = String(
    selectedObject?.get('fontFamily') ?? 'Arial',
  );
  const fontFamilyOptions = FONT_FAMILY_OPTIONS.some(
    (option) => option.value === selectedFontFamily,
  )
    ? FONT_FAMILY_OPTIONS
    : [
        { value: selectedFontFamily, label: selectedFontFamily },
        ...FONT_FAMILY_OPTIONS,
      ];
  const selectedColor = String(selectedObject?.get(colorProperty) ?? '#111827');
  const colorValue = /^#[0-9a-f]{6}$/i.test(selectedColor)
    ? selectedColor
    : '#111827';
  const objectWidth = selectedObject
    ? selectedObject.getScaledWidth() / LABEL_EDITOR_PIXELS_PER_MM
    : 0;
  const objectHeight = selectedObject
    ? selectedObject.getScaledHeight() / LABEL_EDITOR_PIXELS_PER_MM
    : 0;
  const bindingTitle = intl.formatMessage({
    id: isQr
      ? 'project.materialLabels.editor.qrBinding'
      : selectedBinding
        ? (MATERIAL_LABEL_BINDING_FIELDS.find(
            (field) => field.key === selectedBinding,
          )?.messageId ?? 'project.materialLabels.fields.binding')
        : 'project.materialLabels.editor.staticTextBinding',
  });

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-3">
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as MaterialLabelPropertiesTab)
          }
        >
          <TabsList variant="line" size="md" className="w-full">
            {hasSelectedObject ? (
              <TabsTrigger value="design">
                {intl.formatMessage({
                  id: 'project.materialLabels.editor.designTab',
                })}
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="data">
              {intl.formatMessage({
                id: 'project.materialLabels.editor.dataTab',
              })}
            </TabsTrigger>
            <TabsTrigger value="template">
              {intl.formatMessage({
                id: 'project.materialLabels.editor.templateSettings',
              })}
            </TabsTrigger>
          </TabsList>

          {hasSelectedObject ? (
            <TabsContent value="design" className="space-y-4 pt-3">
              {selectedObject ? (
                <>
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">
                        {bindingTitle}
                        {isLocked
                          ? ` · ${intl.formatMessage({ id: 'project.materialLabels.layers.lock' })}`
                          : ''}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        mode="icon"
                        aria-label={intl.formatMessage({
                          id: isLocked
                            ? 'project.materialLabels.layers.unlock'
                            : 'project.materialLabels.layers.lock',
                        })}
                        title={intl.formatMessage({
                          id: isLocked
                            ? 'project.materialLabels.layers.unlock'
                            : 'project.materialLabels.layers.lock',
                        })}
                        disabled={isQr}
                        onClick={() =>
                          onUpdateObject('editorLocked', !isLocked)
                        }
                      >
                        {isLocked ? <LockKeyhole /> : <LockKeyholeOpen />}
                      </Button>
                    </div>

                    <PropertyRow
                      label={intl.formatMessage({
                        id: 'project.materialLabels.fields.componentName',
                      })}
                    >
                      <Input
                        value={String(selectedObject.get('name') ?? '')}
                        disabled={isLocked || isQr}
                        onChange={(event) =>
                          onUpdateObject('name', event.target.value)
                        }
                      />
                    </PropertyRow>

                    {isText ? (
                      <PropertyRow
                        label={intl.formatMessage({
                          id: 'project.materialLabels.fields.text',
                        })}
                      >
                        <Input
                          value={String(
                            selectedObject.get('labelSampleValue') ??
                              selectedObject.get('text') ??
                              '',
                          )}
                          disabled={isLocked}
                          onChange={(event) =>
                            onUpdateObject('text', event.target.value)
                          }
                        />
                      </PropertyRow>
                    ) : null}

                    {selectedObject ? (
                      <>
                        <div className="border-t pt-3">
                          <h3 className="mb-3 text-sm font-semibold">
                            {intl.formatMessage({
                              id: 'project.materialLabels.editor.geometry',
                            })}
                          </h3>
                          <div className="space-y-2">
                            <PropertyRow
                              label={intl.formatMessage({
                                id: 'project.materialLabels.fields.x',
                              })}
                            >
                              <NumericDraftInput
                                step={0.1}
                                value={
                                  Number(selectedObject.left ?? 0) /
                                  LABEL_EDITOR_PIXELS_PER_MM
                                }
                                disabled={isLocked}
                                onCommit={(value) =>
                                  onUpdateMeasurement('left', String(value))
                                }
                              />
                            </PropertyRow>
                            <PropertyRow
                              label={intl.formatMessage({
                                id: 'project.materialLabels.fields.y',
                              })}
                            >
                              <NumericDraftInput
                                step={0.1}
                                value={
                                  Number(selectedObject.top ?? 0) /
                                  LABEL_EDITOR_PIXELS_PER_MM
                                }
                                disabled={isLocked}
                                onCommit={(value) =>
                                  onUpdateMeasurement('top', String(value))
                                }
                              />
                            </PropertyRow>
                            <PropertyRow
                              label={intl.formatMessage({
                                id: 'project.materialLabels.fields.objectWidth',
                              })}
                            >
                              <NumericDraftInput
                                min={0.1}
                                step={0.1}
                                value={objectWidth}
                                disabled={isLocked}
                                onCommit={(value) =>
                                  onUpdateMeasurement('width', String(value))
                                }
                              />
                            </PropertyRow>
                            {!isText ? (
                              <PropertyRow
                                label={intl.formatMessage({
                                  id: 'project.materialLabels.fields.objectHeight',
                                })}
                              >
                                <NumericDraftInput
                                  min={0.1}
                                  step={0.1}
                                  value={objectHeight}
                                  disabled={isLocked}
                                  onCommit={(value) =>
                                    onUpdateMeasurement('height', String(value))
                                  }
                                />
                              </PropertyRow>
                            ) : null}
                            <PropertyRow
                              label={intl.formatMessage({
                                id: 'project.materialLabels.fields.rotation',
                              })}
                            >
                              <NumericDraftInput
                                decimalScale={0}
                                step={1}
                                value={Math.round(
                                  Number(selectedObject.angle ?? 0),
                                )}
                                disabled={isLocked}
                                onCommit={(value) =>
                                  onUpdateMeasurement('angle', String(value))
                                }
                              />
                            </PropertyRow>
                            <PropertyRow
                              label={intl.formatMessage({
                                id: 'project.materialLabels.fields.opacity',
                              })}
                            >
                              <NumericDraftInput
                                decimalScale={0}
                                min={0}
                                max={100}
                                value={Math.round(
                                  Number(selectedObject.opacity ?? 1) * 100,
                                )}
                                disabled={isLocked}
                                onCommit={(value) =>
                                  onUpdateMeasurement('opacity', String(value))
                                }
                              />
                            </PropertyRow>
                          </div>
                        </div>
                      </>
                    ) : null}

                    {isText ? (
                      <div className="space-y-2 border-t pt-3">
                        <h3 className="text-sm font-semibold">
                          {intl.formatMessage({
                            id: 'project.materialLabels.editor.typography',
                          })}
                        </h3>
                        <PropertyRow
                          label={intl.formatMessage({
                            id: 'project.materialLabels.fields.fontFamily',
                          })}
                        >
                          <SelectSearch
                            ariaLabel={intl.formatMessage({
                              id: 'project.materialLabels.fields.fontFamily',
                            })}
                            value={selectedFontFamily}
                            options={fontFamilyOptions}
                            searchable
                            searchPlaceholder={intl.formatMessage({
                              id: 'project.materialLabels.fields.searchFont',
                            })}
                            emptyMessage={intl.formatMessage({
                              id: 'project.materialLabels.fields.noFontMatches',
                            })}
                            canDeselect={false}
                            disabled={isLocked}
                            onChange={(value) =>
                              onUpdateObject('fontFamily', value)
                            }
                          />
                        </PropertyRow>
                        <PropertyRow
                          label={intl.formatMessage({
                            id: 'project.materialLabels.fields.fontSize',
                          })}
                        >
                          <NumericDraftInput
                            decimalScale={0}
                            min={6}
                            max={96}
                            value={Number(selectedObject.get('fontSize') ?? 12)}
                            disabled={isLocked}
                            onCommit={(value) =>
                              onUpdateObject('fontSize', value)
                            }
                          />
                        </PropertyRow>
                        <div className="grid grid-cols-[8.75rem_minmax(0,1fr)] items-center gap-3">
                          <Label>
                            {intl.formatMessage({
                              id: 'project.materialLabels.fields.alignment',
                            })}
                          </Label>
                          <div className="flex gap-1">
                            {[
                              ['left', AlignLeft],
                              ['center', AlignCenter],
                              ['right', AlignRight],
                            ].map(([alignment, Icon]) => {
                              const AlignIcon = Icon as typeof AlignLeft;
                              return (
                                <Button
                                  key={alignment as string}
                                  type="button"
                                  variant={
                                    selectedObject.get('textAlign') ===
                                    alignment
                                      ? 'secondary'
                                      : 'ghost'
                                  }
                                  size="icon"
                                  mode="icon"
                                  disabled={isLocked}
                                  aria-label={String(alignment)}
                                  onClick={() =>
                                    onUpdateObject('textAlign', alignment)
                                  }
                                >
                                  <AlignIcon />
                                </Button>
                              );
                            })}
                            <Button
                              type="button"
                              variant={
                                selectedObject.get('fontWeight') === 'bold'
                                  ? 'secondary'
                                  : 'ghost'
                              }
                              size="icon"
                              mode="icon"
                              disabled={isLocked}
                              aria-label={intl.formatMessage({
                                id: 'project.materialLabels.actions.toggleBold',
                              })}
                              onClick={() =>
                                onUpdateObject(
                                  'fontWeight',
                                  selectedObject.get('fontWeight') === 'bold'
                                    ? 'normal'
                                    : 'bold',
                                )
                              }
                            >
                              <Bold />
                            </Button>
                            <Button
                              type="button"
                              variant={
                                selectedObject.get('fontStyle') === 'italic'
                                  ? 'secondary'
                                  : 'ghost'
                              }
                              size="icon"
                              mode="icon"
                              disabled={isLocked}
                              aria-label={intl.formatMessage({
                                id: 'project.materialLabels.actions.toggleItalic',
                              })}
                              onClick={() =>
                                onUpdateObject(
                                  'fontStyle',
                                  selectedObject.get('fontStyle') === 'italic'
                                    ? 'normal'
                                    : 'italic',
                                )
                              }
                            >
                              <Italic />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {isText || isShape ? (
                      <PropertyRow
                        label={intl.formatMessage({
                          id:
                            colorProperty === 'stroke'
                              ? 'project.materialLabels.fields.stroke'
                              : 'project.materialLabels.fields.fill',
                        })}
                      >
                        <Input
                          type="color"
                          value={colorValue}
                          disabled={isLocked}
                          onChange={(event) =>
                            onUpdateObject(colorProperty, event.target.value)
                          }
                        />
                      </PropertyRow>
                    ) : null}

                    <div className="space-y-2 border-t pt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        className="w-full justify-start"
                        disabled={isLocked || isQr}
                        onClick={onDuplicate}
                      >
                        <Copy />
                        {intl.formatMessage({
                          id: 'project.materialLabels.actions.duplicateElement',
                        })}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        className="w-full justify-start"
                        disabled={isLocked || isQr}
                        onClick={onCenter}
                      >
                        <AlignCenter />
                        {intl.formatMessage({
                          id: 'project.materialLabels.actions.centerElement',
                        })}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        className="w-full justify-start"
                        disabled={isLocked || isQr}
                        onClick={onDelete}
                      >
                        <Trash2 />
                        {intl.formatMessage({
                          id: 'project.materialLabels.actions.deleteElement',
                        })}
                      </Button>
                    </div>
                  </section>
                </>
              ) : null}
            </TabsContent>
          ) : null}

          <TabsContent value="data" className="space-y-4 pt-3">
            <section className="space-y-3">
              <p className="text-sm font-medium">
                {intl.formatMessage({
                  id: 'project.materialLabels.fields.previewMaterial',
                })}
              </p>
              {previewMaterial ? (
                <>
                  <div className="rounded-md border border-border p-3">
                    <MaterialIdentity
                      name={
                        previewMaterial.nameOverride?.trim() ||
                        previewMaterial.modelSnapshot.name
                      }
                      code={previewMaterial.code}
                      imageUrl={
                        previewMaterial.images.find((image) => image.isCover)
                          ?.url
                      }
                    />
                    {previewMaterial.serialNumber ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {intl.formatMessage({
                          id: 'project.materials.fields.serialNumber',
                        })}
                        : {previewMaterial.serialNumber}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => setIsPreviewMaterialDialogOpen(true)}
                    >
                      {intl.formatMessage({
                        id: 'project.materialLabels.actions.changePreviewMaterial',
                      })}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      onClick={() => onPreviewMaterialChange(undefined)}
                    >
                      {intl.formatMessage({
                        id: 'project.materialLabels.actions.clearPreviewMaterial',
                      })}
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="w-full"
                  onClick={() => setIsPreviewMaterialDialogOpen(true)}
                >
                  {intl.formatMessage({
                    id: 'project.materialLabels.actions.choosePreviewMaterial',
                  })}
                </Button>
              )}
            </section>
            {isQr ? (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <p className="text-sm font-medium">
                  {intl.formatMessage({
                    id: 'project.materialLabels.editor.qrBinding',
                  })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {intl.formatMessage({
                    id: 'project.materialLabels.editor.qrBindingHelp',
                  })}
                </p>
              </div>
            ) : selectedObject && bindings.length > 0 ? (
              <>
                <PropertyRow
                  label={intl.formatMessage({
                    id: 'project.materialLabels.fields.binding',
                  })}
                >
                  <Select
                    value={selectedBinding || '__static__'}
                    disabled={isLocked}
                    onValueChange={onUpdateBinding}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__static__">
                        {intl.formatMessage({
                          id: 'project.materialLabels.editor.staticTextBinding',
                        })}
                      </SelectItem>
                      {bindings.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                          {intl.formatMessage({ id: field.messageId })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PropertyRow>
                {isText ? (
                  <PropertyRow
                    label={intl.formatMessage({
                      id: 'project.materialLabels.fields.sampleValue',
                    })}
                  >
                    <Input
                      value={String(
                        selectedObject?.get('labelSampleValue') ??
                          selectedObject?.get('text') ??
                          '',
                      )}
                      disabled={isLocked}
                      onChange={(event) =>
                        onUpdateObject('text', event.target.value)
                      }
                    />
                  </PropertyRow>
                ) : null}
              </>
            ) : selectedObject ? (
              <p className="rounded-md border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">
                {intl.formatMessage({
                  id: 'project.materialLabels.editor.noDataForComponent',
                })}
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="template" className="space-y-3 pt-3">
            <section className="space-y-3">
              <PropertyRow
                label={intl.formatMessage({
                  id: 'project.materialLabels.fields.name',
                })}
              >
                <Input
                  value={metadata.name}
                  onChange={(event) =>
                    onMetadataChange({ name: event.target.value })
                  }
                />
              </PropertyRow>
              <PropertyRow
                label={intl.formatMessage({
                  id: 'project.materialLabels.fields.description',
                })}
              >
                <Input
                  value={metadata.description}
                  onChange={(event) =>
                    onMetadataChange({ description: event.target.value })
                  }
                />
              </PropertyRow>
              <PropertyRow
                label={intl.formatMessage({
                  id: 'project.materialLabels.fields.width',
                })}
              >
                <NumericDraftInput
                  min={20}
                  max={200}
                  step={0.1}
                  value={metadata.widthMm}
                  onCommit={(widthMm) => onMetadataChange({ widthMm })}
                />
              </PropertyRow>
              <PropertyRow
                label={intl.formatMessage({
                  id: 'project.materialLabels.fields.height',
                })}
              >
                <NumericDraftInput
                  min={10}
                  max={120}
                  step={0.1}
                  value={metadata.heightMm}
                  onCommit={(heightMm) => onMetadataChange({ heightMm })}
                />
              </PropertyRow>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="label-template-default">
                  {intl.formatMessage({
                    id: 'project.materialLabels.fields.default',
                  })}
                </Label>
                <Switch
                  id="label-template-default"
                  checked={metadata.isDefault}
                  onCheckedChange={(isDefault) =>
                    onMetadataChange({ isDefault })
                  }
                />
              </div>
              {isEditing ? (
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="label-template-active">
                    {intl.formatMessage({
                      id: metadata.isActive
                        ? 'project.materialLabels.states.active'
                        : 'project.materialLabels.states.inactive',
                    })}
                  </Label>
                  <Switch
                    id="label-template-active"
                    checked={metadata.isActive}
                    onCheckedChange={(isActive) =>
                      onMetadataChange({ isActive })
                    }
                  />
                </div>
              ) : null}
            </section>
          </TabsContent>
        </Tabs>
      </div>
      <MaterialSelectionDialog
        open={isPreviewMaterialDialogOpen}
        onOpenChange={setIsPreviewMaterialDialogOpen}
        selectionMode="single"
        excludeReserved={false}
        allowReservedSelection
        selectedMaterialIds={previewMaterial ? [previewMaterial.id] : []}
        onConfirm={(ids, addedMaterials) => {
          const selectedId = ids[0];
          const material = addedMaterials.find(
            (item) => item.id === selectedId,
          );
          if (material) onPreviewMaterialChange(material);
          else if (!selectedId) onPreviewMaterialChange(undefined);
        }}
      />
    </ScrollArea>
  );
}
