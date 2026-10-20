/**
 * Scaffolded by editor-table-builder from `src/project/handover/table/handover-item.editor-table.fixture.ts`. Run `npm run gen:editor-table` — do NOT hand-write this file.
 * You own this file now — fill computed cell stubs and wire it into the page/card layout. To change
 * columns or viewport behavior, edit the spec and re-gen to a scratch path, then reconcile your edits.
 */
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { MaterialSelect } from '@/project/materials/components/material-select';
import type {
  Material,
  MaterialListFilters,
} from '@/project/materials/model/material';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { PaginationState } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { DataGridProvider } from '@/components/ui/data-grid';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { OptionSelect } from '@/components/ui/option-select';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { HandoverItemInput } from '../model/handover';
import type { HandoverFormValues } from '../model/handover-form-schema';

interface HandoverItemsEditorTableProps {
  form: UseFormReturn<HandoverFormValues>;
  materials: Material[];
  materialFilters: Omit<MaterialListFilters, 'search' | 'page' | 'pageSize'>;
  initialMaterialSearch: string;
  allowReservedByHandoverId?: string;
  onMaterialSelect: (index: number, material: Material) => void;
  createRow: () => HandoverItemInput;
  toolbarContent?: ReactNode;
}

interface HandoverMaterialSelectCellProps {
  material?: Material;
  filters: Omit<MaterialListFilters, 'search' | 'page' | 'pageSize'>;
  initialSearch: string;
  allowReservedByHandoverId?: string;
  index: number;
  onSelect: (index: number, material: Material) => void;
  triggerRef?: (element: HTMLButtonElement | null) => void;
}

function HandoverMaterialSelectCell({
  material,
  filters,
  initialSearch,
  allowReservedByHandoverId,
  index,
  onSelect,
  triggerRef,
}: HandoverMaterialSelectCellProps) {
  const intl = useIntl();

  return (
    <MaterialSelect
      value={material?.id ?? ''}
      selectedMaterial={material}
      filters={filters}
      initialSearch={initialSearch}
      allowReservedByHandoverId={allowReservedByHandoverId}
      ariaLabel={`${intl.formatMessage({ id: 'project.handover.fields.material' })} ${index + 1}`}
      triggerRef={triggerRef}
      size="lg"
      variant="ghost"
      canDeselect={false}
      onSelect={(selected) => {
        if (selected) onSelect(index, selected);
      }}
    />
  );
}

export function HandoverItemsEditorTable({
  form,
  materials,
  materialFilters,
  initialMaterialSearch,
  allowReservedByHandoverId,
  onMaterialSelect,
  createRow,
  toolbarContent,
}: HandoverItemsEditorTableProps) {
  const intl = useIntl();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
    keyName: 'fieldId',
  });
  const watchedRows = form.watch('items') ?? [];
  const pendingMaterialFocusIndex = useRef<number | null>(null);
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

  const materialById = new Map(
    materials.map((material) => [material.id, material]),
  );

  const handleAddRow = () => {
    const newIndex = fields.length;
    pendingMaterialFocusIndex.current = newIndex;
    append(createRow(), { shouldFocus: false });
    setPagination((current) => ({
      ...current,
      pageIndex: Math.floor(fields.length / current.pageSize),
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

  return (
    <DataGridProvider table={paginationTable} recordCount={fields.length}>
      <div className="flex h-fit min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-sm font-semibold text-foreground">
              {intl.formatMessage({ id: 'project.handover.sections.items' })}
            </h2>
            <div className="text-xs text-muted-foreground">
              {intl.formatMessage(
                { id: 'project.handover.table.materialCount' },
                { count: fields.length },
              )}
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {toolbarContent}
            <Button type="button" variant="primary" onClick={handleAddRow}>
              <Plus />
              {intl.formatMessage({ id: 'project.handover.actions.addItem' })}
            </Button>
          </div>
        </div>
        <div className="max-h-[70dvh] min-w-0 overflow-auto">
          <div className="min-w-[920px]">
            <table className="w-full caption-bottom text-foreground text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 z-20 bg-muted w-14">
                    STT
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-muted min-w-64">
                    Vật tư
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-muted w-48">
                    Tình trạng
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-muted min-w-72">
                    {intl.formatMessage({ id: 'project.handover.fields.note' })}
                  </TableHead>
                  <TableHead className="sticky top-0 right-0 z-30 bg-muted w-12 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.length === 0 ? (
                  <TableRow hoverable={false}>
                    <TableCell colSpan={5} className="h-28 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-muted-foreground">
                          {intl.formatMessage({
                            id: 'project.handover.empty.editorItems',
                          })}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleFields.map((field, pageOffset) => {
                    const index = pageStartIndex + pageOffset;
                    const row = watchedRows[index] as
                      HandoverItemInput | undefined;
                    const material = materialById.get(row?.materialId ?? '');
                    const rowErrors = form.formState.errors.items?.[index];

                    return (
                      <TableRow key={field.fieldId} hoverable={false}>
                        <TableCell className="px-4 py-2 align-middle text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="px-2 py-2 align-middle">
                          <div className="flex min-w-0">
                            <HandoverMaterialSelectCell
                              material={material}
                              filters={materialFilters}
                              initialSearch={
                                index === 0 && !material
                                  ? initialMaterialSearch
                                  : ''
                              }
                              allowReservedByHandoverId={
                                allowReservedByHandoverId
                              }
                              index={index}
                              triggerRef={(element) => {
                                if (
                                  element &&
                                  pendingMaterialFocusIndex.current === index
                                ) {
                                  element.focus();
                                  pendingMaterialFocusIndex.current = null;
                                }
                              }}
                              onSelect={onMaterialSelect}
                            />
                            {rowErrors?.materialId?.message ? (
                              <p className="mt-1 text-xs text-destructive">
                                {rowErrors.materialId.message}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2 align-middle">
                          <Controller
                            control={form.control}
                            name={`items.${index}.condition`}
                            render={({ field: inputField }) => (
                              <OptionSelect
                                value={inputField.value}
                                onChange={inputField.onChange}
                                options={[
                                  {
                                    value: 'good',
                                    label: intl.formatMessage({
                                      id: 'project.handover.condition.good',
                                    }),
                                  },
                                  {
                                    value: 'damaged',
                                    label: intl.formatMessage({
                                      id: 'project.handover.condition.damaged',
                                    }),
                                  },
                                ]}
                                searchable={false}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2 align-middle">
                          <Controller
                            control={form.control}
                            name={`items.${index}.note`}
                            render={({ field: inputField }) => (
                              <div className="space-y-1">
                                <Textarea
                                  {...inputField}
                                  rows={1}
                                  variant="md"
                                  autoResize
                                  className="block min-h-8.5 resize-none py-[6px]"
                                  aria-label={`${intl.formatMessage({
                                    id: 'project.handover.fields.note',
                                  })} ${index + 1}`}
                                  aria-invalid={Boolean(rowErrors?.note)}
                                />
                                {rowErrors?.note?.message ? (
                                  <p className="text-xs text-destructive">
                                    {rowErrors.note.message}
                                  </p>
                                ) : null}
                              </div>
                            )}
                          />
                        </TableCell>
                        <TableCell className="sticky right-0 z-10 align-middle bg-card px-3 py-2 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">
                          <div className="flex justify-end gap-1">
                            <Button
                              aria-label={intl.formatMessage({
                                id: 'project.handover.labels.removeMaterial',
                              })}
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
        </div>
        {fields.length > 0 ? (
          <div className="shrink-0 border-t border-border px-4 py-2">
            <DataGridPagination
              sizes={[10, 25, 50]}
              sizesDescription={intl.formatMessage({
                id: 'project.handover.table.paginationSizeDescription',
              })}
              info={intl.formatMessage(
                { id: 'project.handover.table.paginationInfo' },
                { from: '{from}', to: '{to}', count: '{count}' },
              )}
            />
          </div>
        ) : null}
      </div>
    </DataGridProvider>
  );
}
