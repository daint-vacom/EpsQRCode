/**
 * Scaffolded by editor-table-builder from `src/project/data-configuration/table/custom-fields.editor-table.fixture.ts`. Run `npm run gen:editor-table` — do NOT hand-write this file.
 * You own this file now — fill computed cell stubs and wire it into the page/card layout. To change
 * columns or viewport behavior, edit the spec and re-gen to a scratch path, then reconcile your edits.
 */
import type { ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';
import { Switch } from '@/components/ui/switch';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  CustomFieldEditorRow,
  CustomFieldsFormValues,
} from '../forms/custom-fields-editor';
import {
  CUSTOM_FIELD_TYPE_LABELS,
  type CustomFieldType,
} from '../model/custom-field';

function CustomFieldsEditorTableSortableRow({
  id,
  disabled = false,
  renderCells,
}: {
  id: string;
  disabled?: boolean;
  renderCells: (sortable: ReturnType<typeof useSortable>) => ReactNode;
}) {
  const sortable = useSortable({ id, disabled });
  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <TableRow
      ref={sortable.setNodeRef}
      style={style}
      data-dragging={sortable.isDragging || undefined}
    >
      {renderCells(sortable)}
    </TableRow>
  );
}

interface CustomFieldsEditorTableProps {
  form: UseFormReturn<CustomFieldsFormValues>;
  createRow: () => CustomFieldEditorRow;
  toolbarContent?: ReactNode;
  toolbarTitle?: ReactNode;
  onManageOptions?: (index: number) => void;
  readOnly?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canAdd?: boolean;
  canDelete?: boolean;
}

export function CustomFieldsEditorTable({
  form,
  createRow,
  toolbarContent,
  toolbarTitle,
  onManageOptions,
  readOnly = false,
  canCreate = true,
  canUpdate = true,
  canAdd = true,
  canDelete = true,
}: CustomFieldsEditorTableProps) {
  const intl = useIntl();
  const fieldTypeOptions = Object.keys(CUSTOM_FIELD_TYPE_LABELS).map(
    (value) => ({
      value,
      label: intl.formatMessage({ id: `customFields.types.${value}` }),
    }),
  );
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'fields',
    keyName: 'fieldId',
  });
  const watchedRows = form.watch('fields') ?? [];

  const handleAddRow = () => {
    if (!canAdd || !canCreate || readOnly) return;
    append(createRow());
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (readOnly || !canUpdate) return;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((field) => field.fieldId === active.id);
    const newIndex = fields.findIndex((field) => field.fieldId === over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    move(oldIndex, newIndex);
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
      <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">
            {toolbarTitle ??
              intl.formatMessage({ id: 'customFields.fields.sectionTitle' })}
          </h2>
          <div className="text-xs text-muted-foreground">
            {intl.formatMessage(
              { id: 'customFields.fields.rowCount' },
              { count: fields.length },
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {canAdd ? (
            <ShortcutTooltip
              label={intl.formatMessage({
                id: 'customFields.actions.addField',
              })}
              shortcut="Alt + N"
            >
              <Button
                type="button"
                variant="outline"
                data-shortcut-action="create"
                onClick={handleAddRow}
                disabled={readOnly || !canCreate}
              >
                <Plus />
                {intl.formatMessage({ id: 'customFields.actions.addField' })}
              </Button>
            </ShortcutTooltip>
          ) : null}
          {toolbarContent}
        </div>
      </div>
      <ScrollArea
        type="always"
        className="min-w-0 min-h-[360px] min-h-0 flex-1"
        viewportClassName="h-full min-w-0 overflow-y-auto"
      >
        <div className="min-w-[1120px]">
          <table className="w-full caption-bottom text-foreground text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 z-20 bg-muted w-12 text-center"></TableHead>
                <TableHead className="sticky top-0 z-20 bg-muted w-48">
                  {intl.formatMessage({ id: 'customFields.fields.key' })}
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-muted min-w-56">
                  {intl.formatMessage({ id: 'customFields.fields.name' })}
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-muted w-52">
                  {intl.formatMessage({ id: 'customFields.fields.type' })}
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-muted w-32">
                  {intl.formatMessage({ id: 'customFields.fields.required' })}
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-muted w-32">
                  {intl.formatMessage({ id: 'customFields.fields.active' })}
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-muted w-48">
                  {intl.formatMessage({ id: 'customFields.fields.options' })}
                </TableHead>
                <TableHead className="sticky top-0 right-0 z-30 bg-muted w-16 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"></TableHead>
              </TableRow>
            </TableHeader>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map((field) => field.fieldId)}
                strategy={verticalListSortingStrategy}
              >
                <TableBody>
                  {fields.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-28 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <span className="text-muted-foreground">
                            {intl.formatMessage({
                              id: 'customFields.state.empty',
                            })}
                          </span>
                          {canAdd ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleAddRow}
                              disabled={readOnly || !canCreate}
                            >
                              <Plus />
                              {intl.formatMessage({
                                id: 'customFields.actions.addRow',
                              })}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    fields.map((field, index) => {
                      const row = watchedRows[index] as
                        | CustomFieldEditorRow
                        | undefined;
                      const errors = form.formState.errors.fields?.[index];
                      const rowReadOnly =
                        readOnly || (row?.id ? !canUpdate : !canCreate);

                      return (
                        <CustomFieldsEditorTableSortableRow
                          key={field.fieldId}
                          id={field.fieldId}
                          disabled={rowReadOnly}
                          renderCells={(sortable) => (
                            <>
                              <TableCell className="w-12 px-2 py-2 align-top">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  mode="icon"
                                  size="sm"
                                  aria-label={intl.formatMessage(
                                    {
                                      id: 'customFields.actions.reorderRowAria',
                                    },
                                    { row: index + 1 },
                                  )}
                                  title={intl.formatMessage({
                                    id: 'customFields.actions.reorderRowTitle',
                                  })}
                                  disabled={rowReadOnly}
                                  {...sortable.attributes}
                                  {...sortable.listeners}
                                >
                                  <GripVertical />
                                </Button>
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Controller
                                  control={form.control}
                                  name={`fields.${index}.key`}
                                  render={({ field: inputField }) => (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="block w-full">
                                          <Input
                                            {...inputField}
                                            aria-label={intl.formatMessage(
                                              {
                                                id: 'customFields.actions.keyRowAria',
                                              },
                                              { row: index + 1 },
                                            )}
                                            aria-invalid={!!errors?.key}
                                            variant="sm"
                                            disabled={rowReadOnly}
                                          />
                                        </span>
                                      </TooltipTrigger>
                                      {errors?.key?.message && (
                                        <TooltipContent variant="destructive">
                                          {errors.key.message}
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Controller
                                  control={form.control}
                                  name={`fields.${index}.label`}
                                  render={({ field: inputField }) => (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="block w-full">
                                          <Input
                                            {...inputField}
                                            aria-label={intl.formatMessage(
                                              {
                                                id: 'customFields.actions.nameRowAria',
                                              },
                                              { row: index + 1 },
                                            )}
                                            aria-invalid={!!errors?.label}
                                            variant="sm"
                                            disabled={rowReadOnly}
                                          />
                                        </span>
                                      </TooltipTrigger>
                                      {errors?.label?.message && (
                                        <TooltipContent variant="destructive">
                                          {errors.label.message}
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="px-2 py-2 align-top">
                                <Select
                                  value={row?.fieldType ?? 'text'}
                                  onValueChange={(value) =>
                                    form.setValue(
                                      `fields.${index}.fieldType`,
                                      value as CustomFieldType,
                                      {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      },
                                    )
                                  }
                                >
                                  <SelectTrigger
                                    aria-label={intl.formatMessage(
                                      {
                                        id: 'customFields.actions.typeRowAria',
                                      },
                                      { row: index + 1 },
                                    )}
                                    disabled={rowReadOnly}
                                    size="sm"
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {fieldTypeOptions.map((option) => (
                                      <SelectItem
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="px-2 py-2 align-top">
                                <Switch
                                  checked={row?.isRequired ?? false}
                                  onCheckedChange={(checked) =>
                                    form.setValue(
                                      `fields.${index}.isRequired`,
                                      checked,
                                      {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      },
                                    )
                                  }
                                  disabled={rowReadOnly}
                                  aria-label={intl.formatMessage(
                                    {
                                      id: 'customFields.actions.requiredRowAria',
                                    },
                                    { row: index + 1 },
                                  )}
                                />
                              </TableCell>
                              <TableCell className="px-2 py-2 align-top">
                                <Switch
                                  checked={row?.isActive ?? true}
                                  onCheckedChange={(checked) =>
                                    form.setValue(
                                      `fields.${index}.isActive`,
                                      checked,
                                      {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      },
                                    )
                                  }
                                  disabled={rowReadOnly}
                                  aria-label={intl.formatMessage(
                                    {
                                      id: 'customFields.actions.activeRowAria',
                                    },
                                    { row: index + 1 },
                                  )}
                                />
                              </TableCell>
                              <TableCell className="px-2 py-2 align-top">
                                {row?.fieldType === 'select' ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={rowReadOnly || !onManageOptions}
                                    onClick={() => onManageOptions?.(index)}
                                  >
                                    {intl.formatMessage(
                                      { id: 'customFields.options.count' },
                                      { count: row.options.length },
                                    )}
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="sticky right-0 z-10 bg-card px-3 py-2 align-top shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    aria-label={intl.formatMessage(
                                      {
                                        id: 'customFields.actions.deleteRowAria',
                                      },
                                      { row: index + 1 },
                                    )}
                                    title={intl.formatMessage({
                                      id: 'customFields.actions.deleteRow',
                                    })}
                                    type="button"
                                    variant="destructive"
                                    appearance="ghost"
                                    mode="icon"
                                    size="sm"
                                    disabled={
                                      readOnly ||
                                      (Boolean(row?.id) && !canDelete)
                                    }
                                    onClick={() => remove(index)}
                                  >
                                    <Trash2 />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        />
                      );
                    })
                  )}
                </TableBody>
              </SortableContext>
            </DndContext>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
