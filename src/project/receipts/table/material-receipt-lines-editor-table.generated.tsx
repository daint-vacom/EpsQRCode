/**
 * Scaffolded by editor-table-builder from `src/project/receipts/table/material-receipt-line.editor-table.fixture.ts`. Run `npm run gen:editor-table` — do NOT hand-write this file.
 * You own this file now — fill computed cell stubs and wire it into the page/card layout. To change
 * columns or viewport behavior, edit the spec and re-gen to a scratch path, then reconcile your edits.
 */
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { Custodian } from '@/project/custodians/model/custodian';
import type { MaterialModel } from '@/project/material-models/model/material-model';
import { MaterialConditionSelect } from '@/project/materials/components/material-condition-select';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { PaginationState } from '@tanstack/react-table';
import { ChevronDown, Copy, ListPlus, Pencil, Trash2 } from 'lucide-react';
import { Controller, useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataGridProvider } from '@/components/ui/data-grid';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SelectionActionBar } from '@/components/ui/selection-action-bar';
import type { SelectionActionOption } from '@/components/ui/selection-action-bar';
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
import { MaterialIdentity } from '@/components/material-identity';
import { MaterialModelSelectionDialog } from '../components/material-model-selection-dialog';
import type {
  MaterialReceiptFormLine,
  MaterialReceiptFormValues,
} from '../model/material-receipt';

const materialNameCollator = new Intl.Collator('vi', {
  sensitivity: 'base',
  numeric: true,
});

interface MaterialReceiptLinesEditorTableProps {
  form: UseFormReturn<MaterialReceiptFormValues>;
  createLine: () => MaterialReceiptFormLine;
  modelById: ReadonlyMap<string, MaterialReceiptModelIdentity>;
  materialNameByClientId: ReadonlyMap<string, string>;
  filterGroupIds?: ReadonlySet<string> | null;
  receivingParties: readonly Custodian[];
  receivingPartySelectionDisabled: boolean;
  readOnly?: boolean;
  onCopySelected?: (rows: MaterialReceiptFormLine[]) => void;
  onEditMaterial: (index: number) => void;
  onEditReceivingParty: (clientId: string) => void;
  toolbarContent?: ReactNode;
}

export function MaterialReceiptLinesEditorTable({
  form,
  createLine,
  modelById,
  materialNameByClientId,
  filterGroupIds = null,
  receivingParties,
  receivingPartySelectionDisabled,
  readOnly = false,
  onCopySelected,
  onEditMaterial,
  onEditReceivingParty,
  toolbarContent,
}: MaterialReceiptLinesEditorTableProps) {
  const { fields, append, insert, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
    keyName: 'fieldId',
  });
  const watchedRows = form.watch('lines');
  const intl = useIntl();
  const [isModelSelectionOpen, setIsModelSelectionOpen] = useState(false);

  const handleModelsConfirm = (models: MaterialModel[]) => {
    if (models.length === 0) return;
    const firstNewIndex = fields.length;
    append(models.map((model) => ({ ...createLine(), modelId: model.id })));
    setPagination((current) => ({
      ...current,
      pageIndex: Math.floor(firstNewIndex / current.pageSize),
    }));
  };

  const handleDuplicateRow = (index: number) => {
    const currentRow = form.getValues(`lines.${index}`);
    const insertIndex = index + 1;
    insert(insertIndex, cloneReceiptLine(currentRow));
    setPagination((current) => ({
      ...current,
      pageIndex: Math.floor(insertIndex / current.pageSize),
    }));
  };

  const handleDeleteRow = (index: number) => {
    remove(index);
    setPagination((current) => {
      const lastPageIndex = Math.max(
        0,
        Math.ceil((fields.length - 1) / current.pageSize) - 1,
      );
      return current.pageIndex > lastPageIndex
        ? { ...current, pageIndex: lastPageIndex }
        : current;
    });
  };

  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [selectionAction, setSelectionAction] = useState('copy');
  const selectedIndexes = useMemo(
    () =>
      fields
        .map((field, index) =>
          selectedRowIds.includes(field.fieldId) ? index : null,
        )
        .filter((index): index is number => index !== null),
    [fields, selectedRowIds],
  );
  type BulkFieldName = 'quantity' | 'condition' | 'note';
  const bulkFields = [
    { name: 'quantity', label: 'Số lượng', kind: 'number' },
    {
      name: 'condition',
      label: 'Tình trạng',
      kind: 'condition',
    },
    { name: 'note', label: 'Ghi chú', kind: 'text' },
  ] as const;
  const [bulkField, setBulkField] = useState<BulkFieldName>('quantity');
  const [bulkValue, setBulkValue] = useState('');
  const activeBulkField = bulkFields.find((field) => field.name === bulkField);

  const coerceBulkValue = (fieldName: BulkFieldName, rawValue: string) => {
    switch (fieldName) {
      case 'quantity':
        return Number.isNaN(Number(rawValue)) ? 0 : Number(rawValue);
      case 'condition':
        return rawValue;
      case 'note':
        return rawValue;
    }
  };

  const applyBulkValue = (fieldName: BulkFieldName, rawValue: string) => {
    const value = coerceBulkValue(fieldName, rawValue);
    selectedIndexes.forEach((index) => {
      form.setValue(`lines.${index}.${fieldName}` as never, value as never, {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (fieldName === 'note') {
        form.setValue(`lines.${index}.conditionNote`, String(value), {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    });
  };

  const handleBulkApply = () => {
    if (selectedIndexes.length === 0) return;
    applyBulkValue(bulkField, bulkValue);
  };

  const handleSelectAllRows = (checked: boolean) => {
    setSelectedRowIds(
      checked ? sortedRows.map(({ field }) => field.fieldId) : [],
    );
  };

  const handleSelectRow = (rowId: string, checked: boolean) => {
    setSelectedRowIds((current) =>
      checked
        ? current.includes(rowId)
          ? current
          : [...current, rowId]
        : current.filter((id) => id !== rowId),
    );
  };

  const handleSelectionAction = (action: string) => {
    if (action === 'copy') {
      onCopySelected?.(
        selectedIndexes.map(
          (index) => form.getValues('lines')[index] as MaterialReceiptFormLine,
        ),
      );
      setSelectedRowIds([]);
      return;
    }
    if (action === 'delete') {
      remove([...selectedIndexes].sort((a, b) => b - a));
      setSelectedRowIds([]);
      return;
    }
    if (action === 'edit') handleBulkApply();
  };

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const sortedRows = useMemo(
    () =>
      fields
        .map((field, formIndex) => ({
          field,
          formIndex,
          row: watchedRows?.[formIndex],
        }))
        .filter(({ row }) => {
          if (!filterGroupIds) return true;
          const groupId = modelById.get(row?.modelId ?? '')?.groupId;
          return Boolean(groupId && filterGroupIds.has(groupId));
        })
        .sort((left, right) => {
          const leftName = modelById.get(left.row?.modelId ?? '')?.name ?? '';
          const rightName = modelById.get(right.row?.modelId ?? '')?.name ?? '';
          return (
            materialNameCollator.compare(leftName, rightName) ||
            left.formIndex - right.formIndex
          );
        }),
    [fields, filterGroupIds, modelById, watchedRows],
  );
  const paginationTable = useReactTable({
    data: sortedRows.map(({ field }) => field),
    columns: [],
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { pagination },
    onPaginationChange: setPagination,
  });
  const pageStartIndex = pagination.pageIndex * pagination.pageSize;
  const visibleRows = sortedRows.slice(
    pageStartIndex,
    pageStartIndex + pagination.pageSize,
  );
  useEffect(() => {
    setPagination((current) => {
      const lastPageIndex = Math.max(
        0,
        Math.ceil(sortedRows.length / current.pageSize) - 1,
      );
      return current.pageIndex > lastPageIndex
        ? { ...current, pageIndex: lastPageIndex }
        : current;
    });
  }, [sortedRows.length]);

  useEffect(() => {
    setSelectedRowIds([]);
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
    );
  }, [filterGroupIds]);

  return (
    <DataGridProvider table={paginationTable} recordCount={sortedRows.length}>
      <>
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-center">
              <h2 className="whitespace-nowrap text-sm font-semibold text-foreground">
                {intl.formatMessage(
                  { id: 'receipts.fields.itemsHeaderCount' },
                  { count: sortedRows.length },
                )}
              </h2>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {toolbarContent}

              {!readOnly ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setIsModelSelectionOpen(true)}
                >
                  <ListPlus />
                  {intl.formatMessage({ id: 'receipts.actions.chooseModels' })}
                </Button>
              ) : null}
            </div>
          </div>
          <ScrollArea
            type="always"
            className="min-h-0 min-w-0 flex-1"
            viewportClassName="h-full min-w-0 overflow-y-auto"
          >
            <div className="min-w-[1600px]">
              <table className="w-full caption-bottom text-foreground text-sm">
                <TableHeader>
                  <TableRow>
                    {!readOnly ? (
                      <TableHead className="sticky top-0 z-20 w-12 min-w-12 max-w-12 bg-muted px-2 py-2 text-center align-middle">
                        <div className="flex justify-center">
                          <Checkbox
                            aria-label="Chọn tất cả dòng"
                            checked={
                              sortedRows.length > 0 &&
                              (selectedRowIds.length === sortedRows.length ||
                                (selectedRowIds.length > 0 && 'indeterminate'))
                            }
                            disabled={sortedRows.length === 0}
                            size="sm"
                            onCheckedChange={(checked) =>
                              handleSelectAllRows(!!checked)
                            }
                          />
                        </div>
                      </TableHead>
                    ) : null}
                    <TableHead className="sticky top-0 z-20 bg-muted min-w-[280px]">
                      {intl.formatMessage({ id: 'receipts.fields.material' })}
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted min-w-[280px]">
                      {intl.formatMessage({
                        id: 'receipts.modelSelection.model',
                      })}
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted w-36 text-right">
                      Số lượng
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted w-40">
                      {intl.formatMessage({
                        id: 'project.materials.fields.condition',
                      })}
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted min-w-[220px]">
                      {intl.formatMessage({
                        id: 'receipts.handover.recipient',
                      })}
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted min-w-[240px]">
                      {intl.formatMessage({ id: 'receipts.fields.note' })}
                    </TableHead>
                    {!readOnly ? (
                      <TableHead className="sticky top-0 right-0 z-30 bg-muted w-48 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"></TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.length === 0 ? (
                    <TableRow hoverable={false}>
                      <TableCell
                        colSpan={readOnly ? 6 : 8}
                        className="h-28 text-center"
                      >
                        <span className="text-muted-foreground">
                          {intl.formatMessage({ id: 'receipts.emptyLines' })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleRows.map(({ field, formIndex, row }) => {
                      const index = formIndex;
                      const errors = form.formState.errors.lines?.[index];
                      const receivingParty = receivingParties.find(
                        (party) => party.id === row?.receivingPartyId,
                      );
                      return (
                        <TableRow key={field.fieldId} hoverable={false}>
                          {!readOnly ? (
                            <TableCell className="w-12 min-w-12 max-w-12 px-2 py-2 text-center align-middle">
                              <div className="flex justify-center">
                                <Checkbox
                                  aria-label={`Chọn dòng ${index + 1}`}
                                  checked={selectedRowIds.includes(
                                    field.fieldId,
                                  )}
                                  size="sm"
                                  onCheckedChange={(checked) =>
                                    handleSelectRow(field.fieldId, !!checked)
                                  }
                                />
                              </div>
                            </TableCell>
                          ) : null}
                          <TableCell className="px-2 py-2 align-middle">
                            <span className="font-medium text-foreground">
                              {materialNameByClientId.get(
                                row?.clientId ?? '',
                              ) ||
                                modelById.get(row?.modelId ?? '')?.name ||
                                '—'}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-2 align-middle">
                            <MaterialReceiptModelCell
                              line={row}
                              model={modelById.get(row?.modelId ?? '')}
                            />
                          </TableCell>
                          <TableCell className="px-2 py-2">
                            <Controller
                              control={form.control}
                              name={`lines.${index}.quantity`}
                              render={({ field: inputField }) => {
                                const quantityWarning = undefined;
                                const quantityMessage =
                                  errors?.quantity?.message ?? quantityWarning;

                                return quantityMessage ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="block w-full">
                                        <Input
                                          aria-label={`Số lượng dòng ${index + 1}`}
                                          aria-invalid={!!errors?.quantity}
                                          onPointerDown={(event) =>
                                            event.stopPropagation()
                                          }
                                          className="text-right tabular-nums"
                                          min={1}
                                          max={10000}
                                          step={1}
                                          type="number"
                                          value={inputField.value}
                                          variant="md"
                                          readOnly={readOnly}
                                          onBlur={inputField.onBlur}
                                          onChange={(event) =>
                                            inputField.onChange(
                                              Number.isNaN(
                                                event.target.valueAsNumber,
                                              )
                                                ? 0
                                                : event.target.valueAsNumber,
                                            )
                                          }
                                        />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      variant={
                                        errors?.quantity
                                          ? 'destructive'
                                          : 'warning'
                                      }
                                    >
                                      {quantityMessage}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="block w-full">
                                    <Input
                                      aria-label={`Số lượng dòng ${index + 1}`}
                                      aria-invalid={!!errors?.quantity}
                                      onPointerDown={(event) =>
                                        event.stopPropagation()
                                      }
                                      className="text-right tabular-nums"
                                      min={1}
                                      max={10000}
                                      step={1}
                                      type="number"
                                      value={inputField.value}
                                      variant="md"
                                      readOnly={readOnly}
                                      onBlur={inputField.onBlur}
                                      onChange={(event) =>
                                        inputField.onChange(
                                          Number.isNaN(
                                            event.target.valueAsNumber,
                                          )
                                            ? 0
                                            : event.target.valueAsNumber,
                                        )
                                      }
                                    />
                                  </span>
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell className="px-2 py-2">
                            <Controller
                              control={form.control}
                              name={`lines.${index}.condition`}
                              render={({ field: inputField }) => (
                                <MaterialConditionSelect
                                  ariaLabel={`${intl.formatMessage({ id: 'project.materials.fields.condition' })} dòng ${index + 1}`}
                                  value={inputField.value}
                                  onChange={inputField.onChange}
                                  size="md"
                                  disabled={readOnly}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell className="px-2 py-2 align-middle">
                            {readOnly ? (
                              <span className="text-sm text-foreground">
                                {receivingParty?.name ??
                                  (row?.receivingPartyId
                                    ? '—'
                                    : intl.formatMessage({
                                        id: 'receipts.fields.receivingPartyPlaceholder',
                                      }))}
                              </span>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-auto min-h-8 w-full justify-between gap-2 px-2 py-1 text-start font-normal"
                                aria-label={`${intl.formatMessage({ id: 'receipts.handover.recipient' })}: ${receivingParty?.name ?? intl.formatMessage({ id: 'receipts.fields.receivingPartyPlaceholder' })}`}
                                disabled={receivingPartySelectionDisabled}
                                onClick={() => {
                                  if (!row?.clientId) return;
                                  onEditReceivingParty(row.clientId);
                                }}
                              >
                                <span
                                  className={
                                    row?.receivingPartyId
                                      ? 'min-w-0 truncate text-foreground'
                                      : 'min-w-0 truncate text-muted-foreground'
                                  }
                                >
                                  {receivingParty?.name ??
                                    (row?.receivingPartyId
                                      ? '—'
                                      : intl.formatMessage({
                                          id: 'receipts.fields.receivingPartyPlaceholder',
                                        }))}
                                </span>
                                <ChevronDown
                                  className="size-4 shrink-0 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="px-2 py-2">
                            <Controller
                              control={form.control}
                              name={`lines.${index}.note`}
                              render={({ field: inputField }) => (
                                <Input
                                  {...inputField}
                                  aria-label={`Ghi chú dòng ${index + 1}`}
                                  onPointerDown={(event) =>
                                    event.stopPropagation()
                                  }
                                  onChange={(event) => {
                                    inputField.onChange(event);
                                    form.setValue(
                                      `lines.${index}.conditionNote`,
                                      event.currentTarget.value,
                                      {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      },
                                    );
                                  }}
                                  variant="md"
                                  readOnly={readOnly}
                                />
                              )}
                            />
                          </TableCell>
                          {!readOnly ? (
                            <TableCell className="sticky right-0 z-10 bg-card px-1 py-2 align-middle shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">
                              <div className="flex justify-end gap-1">
                                <Button
                                  aria-label={`Sửa vật tư dòng ${index + 1}`}
                                  title={intl.formatMessage({
                                    id: 'receipts.actions.editMaterial',
                                  })}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={!row?.modelId}
                                  onClick={() => onEditMaterial(index)}
                                >
                                  <Pencil className="size-3.5" />
                                  {intl.formatMessage({
                                    id: 'receipts.actions.editMaterial',
                                  })}
                                </Button>
                                <Button
                                  aria-label={`Nhân bản dòng ${index + 1}`}
                                  title="Nhân bản"
                                  type="button"
                                  variant="ghost"
                                  mode="icon"
                                  size="sm"
                                  onClick={() => handleDuplicateRow(index)}
                                >
                                  <Copy />
                                </Button>
                                <Button
                                  aria-label={`Xóa dòng ${index + 1}`}
                                  title="Xóa"
                                  type="button"
                                  variant="destructive"
                                  appearance="ghost"
                                  mode="icon"
                                  size="sm"
                                  onClick={() => handleDeleteRow(index)}
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          {fields.length > 0 ? (
            <div className="shrink-0 border-t border-border px-4 py-2">
              <DataGridPagination
                sizes={[10, 25, 50]}
                sizesDescription="dòng"
                info="{from} - {to} / {count} dòng"
              />
            </div>
          ) : null}
        </div>

        {!readOnly && selectedIndexes.length > 0 && (
          <SelectionActionBar
            ariaLabel={intl.formatMessage({
              id: 'editorTable.selection.toolbar',
            })}
            selectionLabel={
              selectedIndexes.length > 0
                ? intl.formatMessage(
                    { id: 'editorTable.selection.selected' },
                    { count: selectedIndexes.length },
                  )
                : ''
            }
            actionLabel={intl.formatMessage({
              id: 'editorTable.selection.action',
            })}
            actionPlaceholder={intl.formatMessage({
              id: 'editorTable.selection.chooseAction',
            })}
            actions={
              [
                ...(selectedIndexes.length > 0 && onCopySelected
                  ? [
                      {
                        value: 'copy',
                        label: intl.formatMessage({
                          id: 'editorTable.selection.copy',
                        }),
                        icon: 'copy',
                      },
                    ]
                  : []),
                ...(selectedIndexes.length > 0
                  ? [
                      {
                        value: 'delete',
                        label: intl.formatMessage({
                          id: 'editorTable.selection.delete',
                        }),
                        icon: 'delete',
                        destructive: true,
                      },
                    ]
                  : []),
                ...(selectedIndexes.length > 0
                  ? [
                      {
                        value: 'edit',
                        label: intl.formatMessage({
                          id: 'editorTable.selection.edit',
                        }),
                        icon: 'edit',
                      },
                    ]
                  : []),
              ] as SelectionActionOption[]
            }
            action={selectionAction}
            onActionChange={(value) => {
              setSelectionAction(value);
              setBulkValue('');
            }}
            applyLabel={intl.formatMessage({
              id: 'editorTable.selection.apply',
            })}
            onApply={handleSelectionAction}
            applyDisabled={
              selectedIndexes.length === 0 ||
              (selectionAction === 'edit' &&
                bulkField === 'condition' &&
                !bulkValue)
            }
            onClear={
              selectedIndexes.length > 0
                ? () => setSelectedRowIds([])
                : undefined
            }
            clearLabel={intl.formatMessage({
              id: 'editorTable.selection.clear',
            })}
            extraControl={
              selectionAction === 'edit' ? (
                <>
                  <Select
                    value={bulkField}
                    onValueChange={(value) => {
                      setBulkField(value as BulkFieldName);
                      setBulkValue('');
                    }}
                  >
                    <SelectTrigger size="md" className="w-[150px]">
                      <SelectValue label="Trường" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkFields.map((field) => (
                        <SelectItem key={field.name} value={field.name}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activeBulkField?.kind === 'condition' ? (
                    <MaterialConditionSelect
                      ariaLabel="Giá trị áp dụng hàng loạt"
                      value={bulkValue as 'good' | 'damaged' | ''}
                      onChange={setBulkValue}
                      size="md"
                      className="w-48"
                    />
                  ) : activeBulkField?.kind === 'number' ? (
                    <Input
                      aria-label={'Giá trị áp dụng hàng loạt'}
                      className="w-36 text-right tabular-nums"
                      type="number"
                      value={bulkValue}
                      variant="md"
                      onChange={(event) => setBulkValue(event.target.value)}
                    />
                  ) : (
                    <Input
                      aria-label={'Giá trị áp dụng hàng loạt'}
                      className="w-48"
                      value={bulkValue}
                      variant="md"
                      onChange={(event) => setBulkValue(event.target.value)}
                    />
                  )}
                </>
              ) : null
            }
          />
        )}
        {!readOnly ? (
          <MaterialModelSelectionDialog
            open={isModelSelectionOpen}
            onOpenChange={setIsModelSelectionOpen}
            onConfirm={handleModelsConfirm}
          />
        ) : null}
      </>
    </DataGridProvider>
  );
}

function cloneReceiptLine(
  line: MaterialReceiptFormLine,
): MaterialReceiptFormLine {
  return {
    ...line,
    clientId: crypto.randomUUID(),
    lineId: '',
    items: Array.from({ length: line.quantity }, (_, index) => {
      const source = line.items[index];
      const condition = source?.condition ?? line.condition;
      return {
        serialNumber: '',
        condition,
        conditionNote:
          condition === 'damaged'
            ? (source?.conditionNote ?? line.conditionNote)
            : '',
        note: '',
      };
    }),
  };
}

function MaterialReceiptModelCell({
  line,
  model,
}: {
  line?: MaterialReceiptFormLine;
  model?: MaterialReceiptModelIdentity;
}) {
  if (!line || !model) return null;
  return (
    <MaterialIdentity
      name={model.name}
      code={model.code}
      imageUrl={model.imageUrl}
    />
  );
}

interface MaterialReceiptModelIdentity {
  name: string;
  code: string;
  groupId?: string | null;
  imageUrl?: string | null;
}
