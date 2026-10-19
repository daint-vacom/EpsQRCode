/**
 * Scaffolded by editor-table-builder from `src/project/material-models/table/material-model-specifications.editor-table.fixture.ts`. Run `npm run gen:editor-table` — do NOT hand-write this file.
 * You own this file now — fill computed cell stubs and wire it into the page/card layout. To change
 * columns or viewport behavior, edit the spec and re-gen to a scratch path, then reconcile your edits.
 */
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MaterialSpecificationDataTypeIcon } from '@/project/material-specifications/components/material-specification-data-type-icon';
import {
  MATERIAL_SPECIFICATION_DATA_TYPE_CONFIG,
  materialSpecificationDataTypeSchema,
} from '@/project/material-specifications/model/material-specification';
import type { MaterialSpecificationDataType } from '@/project/material-specifications/model/material-specification';
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
import { GripVertical, ListMinus, ListPlus, Plus, Trash2 } from 'lucide-react';
import { useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
import { MaterialModelSpecificationValues } from '../forms/material-model-specification-values';
import type {
  MaterialModelFormValues,
  MaterialModelSpecification,
} from '../model/material-model';
import { convertMaterialModelSpecificationValues } from '../model/material-model-specification-conversion';

const specificationTypes = materialSpecificationDataTypeSchema.options;

function MaterialModelSpecificationsSortableRow({
  id,
  renderCells,
}: {
  id: string;
  renderCells: (sortable: ReturnType<typeof useSortable>) => ReactNode;
}) {
  const sortable = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <TableRow
      ref={sortable.setNodeRef}
      style={style}
      data-dragging={sortable.isDragging || undefined}
      hoverable={false}
    >
      {renderCells(sortable)}
    </TableRow>
  );
}

interface MaterialModelSpecificationsEditorTableProps {
  form: UseFormReturn<MaterialModelFormValues>;
}

export function MaterialModelSpecificationsEditorTable({
  form,
}: MaterialModelSpecificationsEditorTableProps) {
  const intl = useIntl();
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'specifications',
    keyName: 'fieldId',
  });
  const [pendingSingleModeIndex, setPendingSingleModeIndex] = useState<
    number | null
  >(null);
  const pendingFocusIndex = useRef<number | null>(null);
  const watchedRows = form.watch('specifications') ?? [];
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((field) => field.fieldId === active.id);
    const newIndex = fields.findIndex((field) => field.fieldId === over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    move(oldIndex, newIndex);
  };

  const handleAddRow = (dataType: MaterialSpecificationDataType = 'text') => {
    const index = fields.length;
    append(
      {
        id: crypto.randomUUID(),
        dataType,
        name: '',
        isList: false,
        values: dataType === 'boolean' ? ['false'] : [],
      },
      { shouldFocus: false },
    );
    pendingFocusIndex.current = index;
    window.requestAnimationFrame(() => {
      if (pendingFocusIndex.current !== index) return;
      pendingFocusIndex.current = null;
      form.setFocus(`specifications.${index}.name`);
    });
  };

  const handleChangeDataType = (
    index: number,
    dataType: MaterialSpecificationDataType,
  ) => {
    const row = form.getValues(`specifications.${index}`);
    if (!row || row.dataType === dataType) return;

    const values = convertMaterialModelSpecificationValues(
      row.values,
      row.dataType,
      dataType,
    );
    const supportsMultipleValues =
      MATERIAL_SPECIFICATION_DATA_TYPE_CONFIG[dataType].supportsMultipleValues;

    // The save RPC treats an existing row's data type as immutable, so changing
    // its type is persisted as replacing that specification with a new id.
    form.setValue(`specifications.${index}.id`, crypto.randomUUID(), {
      shouldDirty: true,
    });
    form.setValue(`specifications.${index}.dataType`, dataType, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue(
      `specifications.${index}.values`,
      supportsMultipleValues ? values : values.slice(0, 1),
      { shouldDirty: true, shouldValidate: true },
    );
    if (!supportsMultipleValues) {
      form.setValue(`specifications.${index}.isList`, false, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const toggleListMode = (index: number) => {
    const row = form.getValues(`specifications.${index}`);
    if (!row.isList) {
      form.setValue(`specifications.${index}.isList`, true, {
        shouldDirty: true,
        shouldValidate: true,
      });
      return;
    }

    if (row.values.length > 1) {
      setPendingSingleModeIndex(index);
      return;
    }

    form.setValue(`specifications.${index}.isList`, false, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const confirmSingleMode = () => {
    if (pendingSingleModeIndex === null) return;
    const index = pendingSingleModeIndex;
    const row = form.getValues(`specifications.${index}`);
    const firstValue = row.values.find((value) => value.trim()) ?? '';

    form.setValue(`specifications.${index}.values`, [firstValue], {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue(`specifications.${index}.isList`, false, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setPendingSingleModeIndex(null);
  };

  return (
    <Form {...form}>
      <>
        <CardHeader className="border-b border-border">
          <span className="text-xs text-muted-foreground">
            {intl.formatMessage(
              { id: 'materialModels.specifications.count' },
              { count: fields.length },
            )}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleAddRow()}
          >
            <Plus />
            {intl.formatMessage({ id: 'materialModels.specifications.add' })}
          </Button>
        </CardHeader>
        <CardContent className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <ScrollArea
              type="always"
              className="min-h-0 min-w-0 flex-1"
              viewportClassName="h-full min-w-0 overflow-y-auto"
            >
              <div className="min-w-[768px]">
                <SortableContext
                  items={fields.map((field) => field.fieldId)}
                  strategy={verticalListSortingStrategy}
                >
                  <table className="w-full caption-bottom text-foreground text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky top-0 z-20 bg-muted w-12"></TableHead>
                        <TableHead className="sticky top-0 z-20 bg-muted min-w-[260px]">
                          {intl.formatMessage({
                            id: 'materialModels.specifications.column',
                          })}
                        </TableHead>
                        <TableHead className="sticky top-0 z-20 bg-muted min-w-[360px]">
                          {intl.formatMessage({
                            id: 'materialModels.specifications.values',
                          })}
                        </TableHead>
                        <TableHead className="sticky top-0 right-0 z-30 bg-muted w-24 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.length === 0 ? (
                        <TableRow hoverable={false}>
                          <TableCell colSpan={4} className="h-28 text-center">
                            <span className="text-muted-foreground">
                              {intl.formatMessage({
                                id: 'materialModels.specifications.empty',
                              })}
                            </span>
                          </TableCell>
                        </TableRow>
                      ) : (
                        fields.map((field, index) => {
                          const row = watchedRows[index] as
                            MaterialModelSpecification | undefined;

                          return (
                            <MaterialModelSpecificationsSortableRow
                              key={field.fieldId}
                              id={field.fieldId}
                              renderCells={(sortable) => (
                                <>
                                  <TableCell className="w-12 px-2 py-2 align-top">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
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
                                          {...sortable.attributes}
                                          {...sortable.listeners}
                                        >
                                          <GripVertical />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {intl.formatMessage({
                                          id: 'customFields.actions.reorderRowTitle',
                                        })}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableCell>
                                  <TableCell className="px-2 py-2 align-top">
                                    <div className="flex min-w-0 items-start gap-2">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            mode="icon"
                                            size="sm"
                                            aria-label={intl.formatMessage({
                                              id: 'materialModels.specifications.changeType',
                                            })}
                                          >
                                            <MaterialSpecificationDataTypeIcon
                                              dataType={row?.dataType ?? 'text'}
                                            />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start">
                                          {specificationTypes.map(
                                            (dataType) => (
                                              <DropdownMenuItem
                                                key={dataType}
                                                onSelect={() =>
                                                  handleChangeDataType(
                                                    index,
                                                    dataType,
                                                  )
                                                }
                                              >
                                                <MaterialSpecificationDataTypeIcon
                                                  dataType={dataType}
                                                />
                                                {intl.formatMessage({
                                                  id: `materialModels.specifications.types.${dataType}`,
                                                })}
                                              </DropdownMenuItem>
                                            ),
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                      <FormField
                                        control={form.control}
                                        name={`specifications.${index}.name`}
                                        render={({ field: nameField }) => (
                                          <FormItem className="min-w-0 flex-1 space-y-1">
                                            <FormControl>
                                              <Input
                                                {...nameField}
                                                aria-label={`${intl.formatMessage({ id: 'materialModels.specifications.name' })} ${index + 1}`}
                                                variant="ghost-underline"
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-2 py-2 align-top">
                                    <FormField
                                      control={form.control}
                                      name={`specifications.${index}.values`}
                                      render={({ field: valuesField }) => (
                                        <FormItem className="space-y-1">
                                          <FormControl>
                                            <MaterialModelSpecificationValues
                                              dataType={row?.dataType ?? 'text'}
                                              isList={row?.isList ?? false}
                                              values={valuesField.value ?? []}
                                              rowIndex={index}
                                              onChange={valuesField.onChange}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="sticky right-0 z-10 bg-card px-2 py-2 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">
                                    <div className="flex justify-end gap-1">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            mode="icon"
                                            size="sm"
                                            aria-label={intl.formatMessage({
                                              id: row?.isList
                                                ? 'materialModels.specifications.switchToSingle'
                                                : 'materialModels.specifications.switchToList',
                                            })}
                                            onClick={() =>
                                              toggleListMode(index)
                                            }
                                          >
                                            {row?.isList ? (
                                              <ListMinus />
                                            ) : (
                                              <ListPlus />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {intl.formatMessage({
                                            id: row?.isList
                                              ? 'materialModels.specifications.switchToSingle'
                                              : 'materialModels.specifications.switchToList',
                                          })}
                                        </TooltipContent>
                                      </Tooltip>
                                      <Button
                                        aria-label={intl.formatMessage(
                                          {
                                            id: 'materialModels.specifications.removeRow',
                                          },
                                          { name: row?.name || index + 1 },
                                        )}
                                        title={intl.formatMessage({
                                          id: 'common.actions.delete',
                                        })}
                                        type="button"
                                        variant="destructive"
                                        appearance="ghost"
                                        mode="icon"
                                        size="sm"
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
                      <TableRow hoverable={false}>
                        <TableCell colSpan={4} className="px-2 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddRow()}
                          >
                            <Plus />
                            {intl.formatMessage({
                              id: 'materialModels.specifications.add',
                            })}
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </table>
                </SortableContext>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </DndContext>
        </CardContent>
      </>
      <ConfirmDialog
        open={pendingSingleModeIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSingleModeIndex(null);
        }}
        title={intl.formatMessage({
          id: 'materialModels.specifications.switchToSingleTitle',
        })}
        description={intl.formatMessage({
          id: 'materialModels.specifications.switchToSingleDescription',
        })}
        confirmLabel={intl.formatMessage({
          id: 'materialModels.specifications.switchToSingleConfirm',
        })}
        confirmVariant="destructive"
        onConfirm={confirmSingleMode}
      />
    </Form>
  );
}
