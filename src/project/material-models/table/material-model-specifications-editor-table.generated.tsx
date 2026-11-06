/**
 * Scaffolded by editor-table-builder from `src/project/material-models/table/material-model-specifications.editor-table.fixture.ts`. Run `npm run gen:editor-table` — do NOT hand-write this file.
 * You own this file now — fill computed cell stubs and wire it into the page/card layout. To change
 * columns or viewport behavior, edit the spec and re-gen to a scratch path, then reconcile your edits.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MaterialSpecificationDataTypeIcon } from '@/project/material-specifications/components/material-specification-data-type-icon';
import { useMaterialSpecificationsQuery } from '@/project/material-specifications/hooks/use-material-specifications';
import {
  MATERIAL_SPECIFICATION_DATA_TYPE_CONFIG,
  materialSpecificationDataTypeSchema,
} from '@/project/material-specifications/model/material-specification';
import type {
  MaterialSpecification,
  MaterialSpecificationDataType,
} from '@/project/material-specifications/model/material-specification';
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
import {
  ChevronDown,
  GripVertical,
  ListMinus,
  ListPlus,
  Plus,
  Trash2,
} from 'lucide-react';
import { useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ErrorState } from '@/components/ui/error-state';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MaterialModelSpecificationValues } from '../forms/material-model-specification-values';
import { useMaterialSpecificationsClipboard } from '../hooks/use-material-specifications-clipboard';
import type {
  MaterialModelFormValues,
  MaterialModelSpecification,
} from '../model/material-model';
import { convertMaterialModelSpecificationValues } from '../model/material-model-specification-conversion';
import {
  appendClipboardToModelSpecifications,
  createModelSpecificationsClipboard,
} from '../model/material-specifications-clipboard';
import {
  MaterialSpecificationsEditorTableRow,
  MaterialSpecificationsEditorTableView,
} from './material-specifications-editor-table-view';
import type { MaterialSpecificationsEditorTableRowProps } from './material-specifications-editor-table-view';

const specificationTypes = materialSpecificationDataTypeSchema.options;

function MaterialModelSpecificationsSortableRow({
  id,
  renderCells,
}: {
  id: string;
  renderCells: (
    sortable: ReturnType<typeof useSortable>,
    rowProps: MaterialSpecificationsEditorTableRowProps,
  ) => ReactNode;
}) {
  const sortable = useSortable({ id });
  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };

  return renderCells(sortable, {
    rowRef: sortable.setNodeRef,
    rowStyle: style,
    isDragging: sortable.isDragging,
  });
}

interface MaterialModelSpecificationsEditorTableProps {
  form: UseFormReturn<MaterialModelFormValues>;
  publicVisibilityDisabled?: boolean;
  tableTitle?: string;
  allowClipboard?: boolean;
}

export function MaterialModelSpecificationsEditorTable({
  form,
  publicVisibilityDisabled,
  tableTitle,
  allowClipboard = true,
}: MaterialModelSpecificationsEditorTableProps) {
  const intl = useIntl();
  const catalogQuery = useMaterialSpecificationsQuery();
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'specifications',
    keyName: 'fieldId',
  });
  const [pendingSingleModeIndex, setPendingSingleModeIndex] = useState<
    number | null
  >(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectionAction, setSelectionAction] = useState(() =>
    allowClipboard ? 'copy' : 'delete',
  );
  const pendingFocusIndex = useRef<number | null>(null);
  const { clipboard, copy } = useMaterialSpecificationsClipboard();
  const watchedRows = form.watch('specifications') ?? [];
  const selectedRowIds = new Set(selectedRows);
  const selectedCount = fields.filter((field) =>
    selectedRowIds.has(field.fieldId),
  ).length;
  const allSelected = fields.length > 0 && selectedCount === fields.length;
  const someSelected = selectedCount > 0 && !allSelected;
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
        isPublic: true,
        isList: false,
        valueLabels: [],
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

  useEffect(() => {
    const fieldIds = new Set(fields.map((field) => field.fieldId));
    setSelectedRows((current) => {
      const next = current.filter((id) => fieldIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [fields]);

  const handleCopySelected = () => {
    const selectedSpecifications = fields.flatMap((field, index) => {
      if (!selectedRowIds.has(field.fieldId)) return [];
      const specification = watchedRows[index];
      return specification ? [specification] : [];
    });
    const nextClipboard = createModelSpecificationsClipboard(
      selectedSpecifications,
    );
    if (!nextClipboard || !copy(nextClipboard)) {
      toast.error(
        intl.formatMessage({
          id: 'materialModels.specifications.selection.copyError',
        }),
      );
      return;
    }
    toast.success(
      intl.formatMessage(
        { id: 'materialModels.specifications.selection.copied' },
        { count: nextClipboard.items.length },
      ),
    );
  };

  const handlePaste = () => {
    if (!clipboard) return;
    const result = appendClipboardToModelSpecifications(watchedRows, clipboard);
    if (result.specifications.length === 0) return;
    append(result.specifications, { shouldFocus: false });
    toast.success(
      intl.formatMessage(
        { id: 'materialModels.specifications.selection.pasted' },
        { count: result.specifications.length },
      ),
    );
  };

  const handleApplySelectionAction = (action: string) => {
    if (action === 'copy' && allowClipboard) {
      handleCopySelected();
      return;
    }
    if (action === 'delete') {
      const indexes = fields.flatMap((field, index) =>
        selectedRowIds.has(field.fieldId) ? [index] : [],
      );
      if (indexes.length === 0) return;
      remove(indexes);
      setSelectedRows([]);
      toast.success(
        intl.formatMessage(
          { id: 'materialModels.specifications.selection.deleted' },
          { count: indexes.length },
        ),
      );
    }
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
    form.setValue(
      `specifications.${index}.valueLabels`,
      dataType === 'color' ? values.map(() => '') : [],
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
    form.setValue(
      `specifications.${index}.valueLabels`,
      row.values.length > 0 ? [row.valueLabels[0] ?? ''] : [],
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue(`specifications.${index}.isList`, false, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setPendingSingleModeIndex(null);
  };

  return (
    <Form {...form}>
      <>
        <MaterialSpecificationsEditorTableView
          mode="model"
          title={tableTitle}
          allowCopy={allowClipboard}
          count={fields.length}
          selectedCount={selectedCount}
          allSelected={allSelected}
          someSelected={someSelected}
          clipboardCount={allowClipboard ? (clipboard?.items.length ?? 0) : 0}
          onPaste={allowClipboard ? handlePaste : undefined}
          onToggleAll={(checked) =>
            setSelectedRows(checked ? fields.map((field) => field.fieldId) : [])
          }
          selectionAction={selectionAction}
          onSelectionActionChange={setSelectionAction}
          onApplySelectionAction={handleApplySelectionAction}
          onClearSelection={() => setSelectedRows([])}
          onAddRow={() => handleAddRow()}
          emptyState={
            <span className="text-muted-foreground">
              {intl.formatMessage({
                id: 'materialModels.specifications.empty',
              })}
            </span>
          }
          beforeTable={
            catalogQuery.isError ? (
              <div className="px-5 py-2">
                <ErrorState
                  title={intl.formatMessage({
                    id: 'materialSpecifications.errors.loadTitle',
                  })}
                  description={intl.formatMessage({
                    id: 'materialModels.specifications.catalogLoadError',
                  })}
                  onRetry={() => void catalogQuery.refetch()}
                />
              </div>
            ) : null
          }
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={fields.map((field) => field.fieldId)}
              strategy={verticalListSortingStrategy}
            >
              {fields.map((field, index) => {
                const row = watchedRows[index] as
                  | MaterialModelSpecification
                  | undefined;

                return (
                  <MaterialModelSpecificationsSortableRow
                    key={field.fieldId}
                    id={field.fieldId}
                    renderCells={(sortable, rowProps) => (
                      <MaterialSpecificationsEditorTableRow
                        mode="model"
                        {...rowProps}
                      >
                        <>
                          <TableCell className="w-12 min-w-12 max-w-12 px-2 py-2 text-center align-top">
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
                          <TableCell className="w-12 min-w-12 max-w-12 px-2 py-2 text-center align-top">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={selectedRowIds.has(field.fieldId)}
                                aria-label={intl.formatMessage(
                                  {
                                    id: 'materialModels.specifications.selection.selectRow',
                                  },
                                  { name: row?.name || index + 1 },
                                )}
                                onCheckedChange={(checked) =>
                                  setSelectedRows((current) =>
                                    checked === true
                                      ? current.includes(field.fieldId)
                                        ? current
                                        : [...current, field.fieldId]
                                      : current.filter(
                                          (id) => id !== field.fieldId,
                                        ),
                                  )
                                }
                              />
                            </div>
                          </TableCell>
                          <TableCell className="w-24 px-2 py-2 text-center align-top">
                            <FormField
                              control={form.control}
                              name={`specifications.${index}.isPublic`}
                              render={({ field: visibilityField }) => (
                                <Switch
                                  checked={visibilityField.value}
                                  disabled={publicVisibilityDisabled}
                                  aria-label={intl.formatMessage(
                                    {
                                      id: 'project.materials.fields.specificationPublicLabel',
                                    },
                                    { name: row?.name || index + 1 },
                                  )}
                                  onCheckedChange={visibilityField.onChange}
                                />
                              )}
                            />
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
                                  {specificationTypes.map((dataType) => (
                                    <DropdownMenuItem
                                      key={dataType}
                                      onSelect={() =>
                                        handleChangeDataType(index, dataType)
                                      }
                                    >
                                      <MaterialSpecificationDataTypeIcon
                                        dataType={dataType}
                                      />
                                      {intl.formatMessage({
                                        id: `materialModels.specifications.types.${dataType}`,
                                      })}
                                    </DropdownMenuItem>
                                  ))}
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
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    mode="icon"
                                    size="sm"
                                    aria-label={intl.formatMessage({
                                      id: 'materialModels.specifications.chooseFromCatalog',
                                    })}
                                  >
                                    <ChevronDown />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  {(catalogQuery.data ?? []).map(
                                    (definition) => (
                                      <DropdownMenuItem
                                        key={definition.id}
                                        onSelect={() =>
                                          handleChooseCatalogSpecification(
                                            form,
                                            index,
                                            definition,
                                          )
                                        }
                                      >
                                        <MaterialSpecificationDataTypeIcon
                                          dataType={definition.dataType}
                                        />
                                        {definition.name}
                                      </DropdownMenuItem>
                                    ),
                                  )}
                                  {!catalogQuery.isPending &&
                                  (catalogQuery.data?.length ?? 0) === 0 ? (
                                    <DropdownMenuItem disabled>
                                      {intl.formatMessage({
                                        id: 'materialSpecifications.empty.list',
                                      })}
                                    </DropdownMenuItem>
                                  ) : null}
                                  {catalogQuery.isPending ? (
                                    <DropdownMenuItem disabled>
                                      {intl.formatMessage({
                                        id: 'common.state.loading',
                                      })}
                                    </DropdownMenuItem>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                                      suggestions={
                                        findCatalogSpecification(
                                          catalogQuery.data ?? [],
                                          row?.name ?? '',
                                          row?.dataType ?? 'text',
                                        )?.options
                                      }
                                      values={valuesField.value ?? []}
                                      valueLabels={row?.valueLabels ?? []}
                                      rowIndex={index}
                                      onChange={valuesField.onChange}
                                      onValueLabelsChange={(nextLabels) =>
                                        form.setValue(
                                          `specifications.${index}.valueLabels`,
                                          nextLabels,
                                          {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                          },
                                        )
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="sticky right-0 z-10 bg-card px-2 py-2 align-top shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">
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
                                    onClick={() => toggleListMode(index)}
                                  >
                                    {row?.isList ? <ListMinus /> : <ListPlus />}
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
                      </MaterialSpecificationsEditorTableRow>
                    )}
                  />
                );
              })}
              {fields.length > 0 ? (
                <TableRow hoverable={false}>
                  <TableCell colSpan={5} className="px-2 py-2">
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
              ) : null}
            </SortableContext>
          </DndContext>
        </MaterialSpecificationsEditorTableView>
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

function findCatalogSpecification(
  definitions: MaterialSpecification[],
  name: string,
  dataType: MaterialSpecificationDataType,
) {
  return definitions.find(
    (definition) =>
      definition.name === name && definition.dataType === dataType,
  );
}

function handleChooseCatalogSpecification(
  form: UseFormReturn<MaterialModelFormValues>,
  index: number,
  definition: MaterialSpecification,
) {
  const base = `specifications.${index}` as const;
  form.setValue(`${base}.id`, crypto.randomUUID(), { shouldDirty: true });
  form.setValue(`${base}.name`, definition.name, {
    shouldDirty: true,
    shouldValidate: true,
  });
  form.setValue(`${base}.dataType`, definition.dataType, {
    shouldDirty: true,
    shouldValidate: true,
  });
  form.setValue(`${base}.isList`, false, {
    shouldDirty: true,
    shouldValidate: true,
  });
  form.setValue(`${base}.isPublic`, true, {
    shouldDirty: true,
    shouldValidate: true,
  });
  form.setValue(
    `${base}.values`,
    definition.dataType === 'boolean'
      ? ['false']
      : definition.dataType === 'color'
        ? ['#1677ff']
        : [],
    { shouldDirty: true, shouldValidate: true },
  );
  form.setValue(
    `${base}.valueLabels`,
    definition.dataType === 'color' ? [''] : [],
    { shouldDirty: true, shouldValidate: true },
  );
}
