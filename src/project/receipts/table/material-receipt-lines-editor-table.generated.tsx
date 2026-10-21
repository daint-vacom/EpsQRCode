/**
 * Scaffolded by editor-table-builder from `src/project/receipts/table/material-receipt-line.editor-table.fixture.ts`. Run `npm run gen:editor-table` — do NOT hand-write this file.
 * You own this file now — fill computed cell stubs and wire it into the page/card layout. To change
 * columns or viewport behavior, edit the spec and re-gen to a scratch path, then reconcile your edits.
 */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { MaterialGroupSelect } from '@/project/material-groups/components/material-group-select';
import { MaterialModelSelect } from '@/project/material-models/components/material-model-select';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { PaginationState } from '@tanstack/react-table';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { DataGridProvider } from '@/components/ui/data-grid';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  MaterialReceiptFormLine,
  MaterialReceiptFormValues,
} from '../model/material-receipt';

interface MaterialReceiptLinesEditorTableProps {
  form: UseFormReturn<MaterialReceiptFormValues>;
  createLine: () => MaterialReceiptFormLine;
  lockExistingModels?: boolean;
  toolbarContent?: ReactNode;
  title?: ReactNode;
}

export function MaterialReceiptLinesEditorTable({
  form,
  createLine,
  lockExistingModels = false,
  toolbarContent,
  title,
}: MaterialReceiptLinesEditorTableProps) {
  const { fields, append, insert, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
    keyName: 'fieldId',
  });
  const watchedRows = form.watch('lines') ?? [];

  const handleAddRow = () => {
    append(createLine());
    setPagination((current) => ({
      ...current,
      pageIndex: Math.floor(fields.length / current.pageSize),
    }));
  };

  const handleAddRowBelow = (index: number) => {
    const insertIndex = index + 1;
    insert(insertIndex, createLine());
    setPagination((current) => ({
      ...current,
      pageIndex: Math.floor(insertIndex / current.pageSize),
    }));
  };

  const handleDuplicateRow = (index: number) => {
    const currentRow = form.getValues(`lines.${index}`);
    const insertIndex = index + 1;
    insert(insertIndex, {
      ...currentRow,
      clientId: crypto.randomUUID(),
      lineId: '',
      items: currentRow.items.map(
        ({ receiptItemId: _receiptItemId, ...item }) => item,
      ),
    });
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

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const paginationTable = useReactTable({
    data: fields,
    columns: [],
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { pagination },
    onPaginationChange: setPagination,
  });
  const pageStartIndex = pagination.pageIndex * pagination.pageSize;
  const visibleFields = fields.slice(
    pageStartIndex,
    pageStartIndex + pagination.pageSize,
  );
  useEffect(() => {
    setPagination((current) => {
      const lastPageIndex = Math.max(
        0,
        Math.ceil(fields.length / current.pageSize) - 1,
      );
      return current.pageIndex > lastPageIndex
        ? { ...current, pageIndex: lastPageIndex }
        : current;
    });
  }, [fields.length]);

  return (
    <DataGridProvider table={paginationTable} recordCount={fields.length}>
      <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-sm font-semibold text-foreground">
              {title ?? 'Danh sách mẫu vật tư'}
            </h2>
            <div className="text-xs text-muted-foreground">
              {fields.length} dòng
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {toolbarContent}

            <Button type="button" variant="primary" onClick={handleAddRow}>
              <Plus />
              Thêm dòng
            </Button>
          </div>
        </div>
        <ScrollArea
          type="always"
          className="min-w-0 min-h-[360px] min-h-0 flex-1"
          viewportClassName="h-full min-w-0 overflow-y-auto"
        >
          <div className="min-w-[1180px]">
            <table className="w-full caption-bottom text-foreground text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 z-20 bg-muted min-w-[430px]">
                    Mẫu vật tư
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-muted w-36">
                    Mã liên kết ngoài
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-muted w-36 text-right">
                    Số lượng
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-muted min-w-[260px]">
                    Chi tiết từng vật tư
                  </TableHead>
                  <TableHead className="sticky top-0 right-0 z-30 bg-muted w-14 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.length === 0 ? (
                  <TableRow hoverable={false}>
                    <TableCell colSpan={5} className="h-28 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-muted-foreground">
                          Chưa có dữ liệu
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAddRow}
                        >
                          <Plus />
                          Thêm dòng
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleFields.map((field, pageOffset) => {
                    const index = pageStartIndex + pageOffset;
                    const row = watchedRows[index] as
                      MaterialReceiptFormLine | undefined;
                    const errors = form.formState.errors.lines?.[index];
                    void row;

                    return (
                      <TableRow key={field.fieldId} hoverable={false}>
                        <TableCell className="px-2 py-2 align-top">
                          <MaterialReceiptModelCell
                            form={form}
                            index={index}
                            line={row}
                            lockExistingModels={lockExistingModels}
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Controller
                            control={form.control}
                            name={`lines.${index}.externalCode`}
                            render={({ field: inputField }) => {
                              const externalCodeWarning = undefined;
                              const externalCodeMessage =
                                errors?.externalCode?.message ??
                                externalCodeWarning;

                              return externalCodeMessage ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block w-full">
                                      <Input
                                        {...inputField}
                                        aria-label={`Mã liên kết ngoài dòng ${index + 1}`}
                                        aria-invalid={!!errors?.externalCode}
                                        onPointerDown={(event) =>
                                          event.stopPropagation()
                                        }
                                        variant="md"
                                      />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    variant={
                                      errors?.externalCode
                                        ? 'destructive'
                                        : 'warning'
                                    }
                                  >
                                    {externalCodeMessage}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="block w-full">
                                  <Input
                                    {...inputField}
                                    aria-label={`Mã liên kết ngoài dòng ${index + 1}`}
                                    aria-invalid={!!errors?.externalCode}
                                    onPointerDown={(event) =>
                                      event.stopPropagation()
                                    }
                                    variant="md"
                                  />
                                </span>
                              );
                            }}
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
                              const updateQuantity = (value: number) => {
                                inputField.onChange(value);
                                const current =
                                  form.getValues(`lines.${index}.items`) ?? [];
                                const desired = Math.max(
                                  0,
                                  Math.min(10000, Math.trunc(value || 0)),
                                );
                                form.setValue(
                                  `lines.${index}.items`,
                                  Array.from(
                                    { length: desired },
                                    (_unused, itemIndex) =>
                                      current[itemIndex] ?? {
                                        serialNumber: '',
                                        condition: 'good' as const,
                                        conditionNote: '',
                                        note: '',
                                      },
                                  ),
                                  { shouldDirty: true, shouldValidate: true },
                                );
                              };

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
                                        onBlur={inputField.onBlur}
                                        onChange={(event) =>
                                          updateQuantity(
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
                                    onBlur={inputField.onBlur}
                                    onChange={(event) =>
                                      updateQuantity(
                                        Number.isNaN(event.target.valueAsNumber)
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
                        <TableCell className="px-2 py-2 align-top">
                          <MaterialReceiptUnitsCell form={form} index={index} />
                        </TableCell>
                        <TableCell className="sticky right-0 z-10 bg-card px-3 py-2 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">
                          <div className="flex justify-end gap-1">
                            <Button
                              aria-label={`Nhân đôi dòng ${index + 1}`}
                              title="Nhân đôi"
                              type="button"
                              variant="ghost"
                              mode="icon"
                              size="sm"
                              onClick={() => handleDuplicateRow(index)}
                            >
                              <Copy />
                            </Button>
                            <Button
                              aria-label={`Thêm dòng dưới dòng ${index + 1}`}
                              title="Thêm dòng dưới"
                              type="button"
                              variant="ghost"
                              mode="icon"
                              size="sm"
                              onClick={() => handleAddRowBelow(index)}
                            >
                              <Plus />
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
    </DataGridProvider>
  );
}

function MaterialReceiptModelCell({
  form,
  index,
  line,
  lockExistingModels,
}: {
  form: UseFormReturn<MaterialReceiptFormValues>;
  index: number;
  line?: MaterialReceiptFormLine;
  lockExistingModels: boolean;
}) {
  const mode = form.watch(`lines.${index}.modelMode`);
  const locked = lockExistingModels && Boolean(line?.lineId);
  return (
    <div className="min-w-[390px] space-y-2">
      <OptionSelect
        aria-label={`Loại mẫu vật tư dòng ${index + 1}`}
        value={mode}
        disabled={locked}
        onChange={(value) => {
          const next = value as 'existing' | 'new';
          form.setValue(`lines.${index}.modelMode`, next, {
            shouldDirty: true,
          });
          if (next === 'existing') {
            form.setValue(`lines.${index}.newModelName`, '', {
              shouldDirty: true,
            });
            form.setValue(`lines.${index}.groupId`, '', { shouldDirty: true });
          } else {
            form.setValue(`lines.${index}.modelId`, '', { shouldDirty: true });
          }
        }}
        options={[
          { value: 'existing', label: 'Mẫu có sẵn' },
          { value: 'new', label: 'Khai báo mẫu mới' },
        ]}
        searchable={false}
      />
      {mode === 'new' ? (
        <div className="space-y-2">
          <Input
            aria-label={`Tên mẫu mới dòng ${index + 1}`}
            value={form.watch(`lines.${index}.newModelName`) ?? ''}
            onChange={(event) =>
              form.setValue(`lines.${index}.newModelName`, event.target.value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            variant="md"
          />
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
            <MaterialGroupSelect
              aria-label={`Nhóm vật tư dòng ${index + 1}`}
              value={form.watch(`lines.${index}.groupId`) ?? ''}
              onChange={(value) =>
                form.setValue(`lines.${index}.groupId`, value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            <Input
              aria-label={`Mã mẫu mới dòng ${index + 1}`}
              value={form.watch(`lines.${index}.newModelCode`) ?? ''}
              onChange={(event) =>
                form.setValue(
                  `lines.${index}.newModelCode`,
                  event.target.value,
                  { shouldDirty: true },
                )
              }
              variant="md"
            />
          </div>
        </div>
      ) : (
        <>
          <MaterialModelSelect
            aria-label={`Mẫu vật tư dòng ${index + 1}`}
            value={form.watch(`lines.${index}.modelId`) ?? ''}
            disabled={locked}
            onChange={(value) =>
              form.setValue(`lines.${index}.modelId`, value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
          {!line?.modelId && line?.externalCode?.trim() ? (
            <p className="text-xs text-muted-foreground">
              Mã liên kết ngoài sẽ được tra cứu khi lưu.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function MaterialReceiptUnitsCell({
  form,
  index,
}: {
  form: UseFormReturn<MaterialReceiptFormValues>;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Controller
      control={form.control}
      name={`lines.${index}.items`}
      render={({ field }) => {
        const items = field.value ?? [];
        const damagedCount = items.filter(
          (item) => item.condition === 'damaged',
        ).length;
        return (
          <div className="min-w-[245px]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Ẩn chi tiết' : 'Sửa từng vật tư'} ({items.length})
            </Button>
            <span className="ml-2 text-xs text-muted-foreground">
              {damagedCount ? `${damagedCount} hỏng` : 'Tốt'}
            </span>
            {expanded ? (
              <div className="mt-2 max-h-64 space-y-3 overflow-y-auto rounded-md border border-border p-2">
                {items.map((item, itemIndex) => (
                  <div
                    key={item.receiptItemId ?? itemIndex}
                    className="space-y-2 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="text-xs font-medium text-muted-foreground">
                      Vật tư {itemIndex + 1}
                    </div>
                    <Input
                      aria-label={`Số sê-ri vật tư ${itemIndex + 1}`}
                      value={item.serialNumber}
                      onChange={(event) =>
                        field.onChange(
                          items.map((current, position) =>
                            position === itemIndex
                              ? { ...current, serialNumber: event.target.value }
                              : current,
                          ),
                        )
                      }
                      variant="sm"
                    />
                    <OptionSelect
                      aria-label={`Tình trạng vật tư ${itemIndex + 1}`}
                      value={item.condition}
                      onChange={(value) =>
                        field.onChange(
                          items.map((current, position) =>
                            position === itemIndex
                              ? {
                                  ...current,
                                  condition: value as 'good' | 'damaged',
                                }
                              : current,
                          ),
                        )
                      }
                      options={[
                        { value: 'good', label: 'Tốt' },
                        { value: 'damaged', label: 'Hỏng' },
                      ]}
                      searchable={false}
                      size="sm"
                    />
                    {item.condition === 'damaged' ? (
                      <Input
                        aria-label={`Mô tả tình trạng hỏng vật tư ${itemIndex + 1}`}
                        value={item.conditionNote}
                        onChange={(event) =>
                          field.onChange(
                            items.map((current, position) =>
                              position === itemIndex
                                ? {
                                    ...current,
                                    conditionNote: event.target.value,
                                  }
                                : current,
                            ),
                          )
                        }
                        variant="sm"
                      />
                    ) : null}
                    <Textarea
                      aria-label={`Ghi chú vật tư ${itemIndex + 1}`}
                      rows={1}
                      value={item.note}
                      onChange={(event) =>
                        field.onChange(
                          items.map((current, position) =>
                            position === itemIndex
                              ? { ...current, note: event.target.value }
                              : current,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      }}
    />
  );
}
