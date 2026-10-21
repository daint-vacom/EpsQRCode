/**
 * Scaffolded by editor-table-builder from `src/project/handover/table/handover-item.editor-table.fixture.ts`. Run `npm run gen:editor-table` — do NOT hand-write this file.
 * You own this file now — fill computed cell stubs and wire it into the page/card layout. To change
 * columns or viewport behavior, edit the spec and re-gen to a scratch path, then reconcile your edits.
 */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { MaterialSelectionDialog } from '@/project/materials/components/material-selection-dialog';
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
import { ListPlus, Trash2 } from 'lucide-react';
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
import { MaterialIdentity } from '@/components/material-identity';
import type { HandoverItemInput } from '../model/handover';
import type { HandoverFormValues } from '../model/handover-form-schema';

interface HandoverItemsEditorTableProps {
  form: UseFormReturn<HandoverFormValues>;
  materials: Material[];
  materialFilters: Omit<MaterialListFilters, 'search' | 'page' | 'pageSize'>;
  initialMaterialSearch: string;
  allowReservedByHandoverId?: string;
  fillHeight?: boolean;
  toolbarContent?: ReactNode;
}

export function HandoverItemsEditorTable({
  form,
  materials,
  materialFilters,
  initialMaterialSearch,
  allowReservedByHandoverId,
  fillHeight = false,
  toolbarContent,
}: HandoverItemsEditorTableProps) {
  const intl = useIntl();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
    keyName: 'fieldId',
  });
  const watchedRows = form.watch('items') ?? [];
  const [dialogMaterials, setDialogMaterials] = useState<Material[]>([]);
  const [isMaterialDialogOpen, setIsMaterialDialogOpen] = useState(false);
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
    [...materials, ...dialogMaterials].map((material) => [
      material.id,
      material,
    ]),
  );

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

  const selectedMaterialIds = watchedRows
    .map((row) => row.materialId)
    .filter(Boolean);
  const handleMaterialConfirm = (
    selectedIds: string[],
    addedMaterials: Material[],
  ) => {
    const selectedIdSet = new Set(selectedIds);
    const removeIndices = fields
      .map((_field, index) => index)
      .filter(
        (index) => !selectedIdSet.has(watchedRows[index]?.materialId ?? ''),
      )
      .reverse();
    removeIndices.forEach(remove);

    const currentIds = new Set(
      watchedRows
        .map((row) => row.materialId)
        .filter((id) => selectedIdSet.has(id)),
    );
    const newMaterials = addedMaterials.filter(
      (material) =>
        selectedIdSet.has(material.id) && !currentIds.has(material.id),
    );
    setDialogMaterials((current) => {
      const knownIds = new Set(current.map((material) => material.id));
      return [
        ...current,
        ...newMaterials.filter((material) => !knownIds.has(material.id)),
      ];
    });
    newMaterials.forEach((material) => {
      append({
        materialId: material.id,
        condition: material.condition,
        note: material.note ?? '',
      });
    });
  };

  return (
    <DataGridProvider table={paginationTable} recordCount={fields.length}>
      <div
        className={
          fillHeight
            ? 'flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden'
            : 'flex h-fit min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden'
        }
      >
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
            <Button
              type="button"
              variant="primary"
              onClick={() => setIsMaterialDialogOpen(true)}
            >
              <ListPlus />
              {intl.formatMessage({ id: 'project.handover.actions.addItem' })}
            </Button>
          </div>
        </div>
        <div
          className={
            fillHeight
              ? 'min-h-0 min-w-0 flex-1 overflow-auto'
              : 'max-h-[70dvh] min-w-0 overflow-auto'
          }
        >
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
                  <TableHead className="sticky top-0 z-20 bg-muted w-32 max-w-32">
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
                            {material ? (
                              <MaterialIdentity
                                name={
                                  material.nameOverride?.trim() ||
                                  material.modelSnapshot.name
                                }
                                code={material.code}
                                imageUrl={
                                  material.images.find((image) => image.isCover)
                                    ?.url
                                }
                              />
                            ) : null}
                            {rowErrors?.materialId?.message ? (
                              <p className="mt-1 text-xs text-destructive">
                                {rowErrors.materialId.message}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="w-32 max-w-32 px-2 py-2 align-middle">
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
      <MaterialSelectionDialog
        open={isMaterialDialogOpen}
        onOpenChange={setIsMaterialDialogOpen}
        title={intl.formatMessage({
          id: 'project.handover.materialSelection.title',
        })}
        filters={materialFilters}
        initialSearch={initialMaterialSearch}
        allowReservedByHandoverId={allowReservedByHandoverId}
        selectedMaterialIds={selectedMaterialIds}
        onConfirm={handleMaterialConfirm}
      />
    </DataGridProvider>
  );
}
