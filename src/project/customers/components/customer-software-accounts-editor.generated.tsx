/**
 * Scaffolded by editor-table-builder from `src/project/customers/table/customer-software-accounts.editor-table.fixture.ts`. Run `npm run gen:editor-table` — do NOT hand-write this file.
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
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
import type {
  CustomerFormValues,
  CustomerSoftwareAccount,
} from '../model/customer';

function CustomerSoftwareAccountsEditorTableSortableRow({
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
    >
      {renderCells(sortable)}
    </TableRow>
  );
}

interface CustomerSoftwareAccountsEditorTableProps {
  form: UseFormReturn<CustomerFormValues>;
  createRow: () => CustomerSoftwareAccount;
}

export function CustomerSoftwareAccountsEditorTable({
  form,
  createRow,
}: CustomerSoftwareAccountsEditorTableProps) {
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'softwareAccounts',
    keyName: 'fieldId',
  });
  const watchedRows = form.watch('softwareAccounts') ?? [];

  const handleAddRow = () => {
    append(createRow());
  };

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

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
      <ScrollArea
        type="always"
        className="min-w-0 min-h-[360px] min-h-0 flex-1"
        viewportClassName="h-full min-w-0 overflow-y-auto"
      >
        <div className="min-w-[1160px]">
          <table className="w-full caption-bottom text-foreground text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 z-20 w-12 bg-muted text-center"></TableHead>
                <TableHead className="sticky top-0 z-20 min-w-48 bg-muted">
                  Tên phần mềm *
                </TableHead>
                <TableHead className="sticky top-0 z-20 min-w-56 bg-muted">
                  Địa chỉ truy cập
                </TableHead>
                <TableHead className="sticky top-0 z-20 min-w-44 bg-muted">
                  Tài khoản
                </TableHead>
                <TableHead className="sticky top-0 z-20 min-w-40 bg-muted">
                  Mật khẩu
                </TableHead>
                <TableHead className="sticky top-0 z-20 w-40 bg-muted">
                  Loại tài khoản
                </TableHead>
                <TableHead className="sticky top-0 z-20 w-44 bg-muted">
                  Ngày hết hạn
                </TableHead>
                <TableHead className="sticky top-0 right-0 z-30 w-16 bg-muted text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"></TableHead>
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
                      <TableCell
                        colSpan={8}
                        className="h-20 text-center text-muted-foreground"
                      >
                        Chưa có dữ liệu
                      </TableCell>
                    </TableRow>
                  ) : (
                    fields.map((field, index) => {
                      const row = watchedRows[index] as
                        CustomerSoftwareAccount | undefined;
                      const errors =
                        form.formState.errors.softwareAccounts?.[index];

                      return (
                        <CustomerSoftwareAccountsEditorTableSortableRow
                          key={field.fieldId}
                          id={field.fieldId}
                          renderCells={(sortable) => (
                            <>
                              <TableCell className="w-12 px-2 py-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  mode="icon"
                                  size="sm"
                                  aria-label={`Kéo để sắp xếp dòng ${index + 1}`}
                                  title="Kéo để sắp xếp"
                                  {...sortable.attributes}
                                  {...sortable.listeners}
                                >
                                  <GripVertical />
                                </Button>
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Controller
                                  control={form.control}
                                  name={`softwareAccounts.${index}.softwareName`}
                                  render={({ field: inputField }) => {
                                    const softwareNameWarning = undefined;
                                    const softwareNameMessage =
                                      errors?.softwareName?.message ??
                                      softwareNameWarning;

                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="block w-full">
                                            <Input
                                              {...inputField}
                                              aria-label={`Tên phần mềm * dòng ${index + 1}`}
                                              aria-invalid={
                                                !!errors?.softwareName
                                              }
                                              variant="md"
                                            />
                                          </span>
                                        </TooltipTrigger>
                                        {softwareNameMessage && (
                                          <TooltipContent
                                            variant={
                                              errors?.softwareName
                                                ? 'destructive'
                                                : 'warning'
                                            }
                                          >
                                            {softwareNameMessage}
                                          </TooltipContent>
                                        )}
                                      </Tooltip>
                                    );
                                  }}
                                />
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Controller
                                  control={form.control}
                                  name={`softwareAccounts.${index}.accessUrl`}
                                  render={({ field: inputField }) => {
                                    const accessUrlWarning = undefined;
                                    const accessUrlMessage =
                                      errors?.accessUrl?.message ??
                                      accessUrlWarning;

                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="block w-full">
                                            <Input
                                              {...inputField}
                                              aria-label={`Địa chỉ truy cập dòng ${index + 1}`}
                                              aria-invalid={!!errors?.accessUrl}
                                              type="url"
                                              variant="md"
                                            />
                                          </span>
                                        </TooltipTrigger>
                                        {accessUrlMessage && (
                                          <TooltipContent
                                            variant={
                                              errors?.accessUrl
                                                ? 'destructive'
                                                : 'warning'
                                            }
                                          >
                                            {accessUrlMessage}
                                          </TooltipContent>
                                        )}
                                      </Tooltip>
                                    );
                                  }}
                                />
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Controller
                                  control={form.control}
                                  name={`softwareAccounts.${index}.username`}
                                  render={({ field: inputField }) => {
                                    const usernameWarning = undefined;
                                    const usernameMessage =
                                      errors?.username?.message ??
                                      usernameWarning;

                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="block w-full">
                                            <Input
                                              {...inputField}
                                              aria-label={`Tài khoản dòng ${index + 1}`}
                                              aria-invalid={!!errors?.username}
                                              variant="md"
                                            />
                                          </span>
                                        </TooltipTrigger>
                                        {usernameMessage && (
                                          <TooltipContent
                                            variant={
                                              errors?.username
                                                ? 'destructive'
                                                : 'warning'
                                            }
                                          >
                                            {usernameMessage}
                                          </TooltipContent>
                                        )}
                                      </Tooltip>
                                    );
                                  }}
                                />
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Controller
                                  control={form.control}
                                  name={`softwareAccounts.${index}.password`}
                                  render={({ field: inputField }) => {
                                    const passwordWarning = undefined;
                                    const passwordMessage =
                                      errors?.password?.message ??
                                      passwordWarning;

                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="block w-full">
                                            <Input
                                              {...inputField}
                                              aria-label={`Mật khẩu dòng ${index + 1}`}
                                              aria-invalid={!!errors?.password}
                                              placeholder={
                                                row?.hasPassword
                                                  ? 'Đã lưu mật khẩu'
                                                  : undefined
                                              }
                                              type="password"
                                              variant="md"
                                            />
                                          </span>
                                        </TooltipTrigger>
                                        {passwordMessage && (
                                          <TooltipContent
                                            variant={
                                              errors?.password
                                                ? 'destructive'
                                                : 'warning'
                                            }
                                          >
                                            {passwordMessage}
                                          </TooltipContent>
                                        )}
                                      </Tooltip>
                                    );
                                  }}
                                />
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Controller
                                  control={form.control}
                                  name={`softwareAccounts.${index}.accountType`}
                                  render={({ field: inputField }) => {
                                    const accountTypeWarning = undefined;
                                    const accountTypeMessage =
                                      errors?.accountType?.message ??
                                      accountTypeWarning;

                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="block w-full">
                                            <Input
                                              {...inputField}
                                              aria-label={`Loại tài khoản dòng ${index + 1}`}
                                              aria-invalid={
                                                !!errors?.accountType
                                              }
                                              variant="md"
                                            />
                                          </span>
                                        </TooltipTrigger>
                                        {accountTypeMessage && (
                                          <TooltipContent
                                            variant={
                                              errors?.accountType
                                                ? 'destructive'
                                                : 'warning'
                                            }
                                          >
                                            {accountTypeMessage}
                                          </TooltipContent>
                                        )}
                                      </Tooltip>
                                    );
                                  }}
                                />
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <Controller
                                  control={form.control}
                                  name={`softwareAccounts.${index}.expiresAt`}
                                  render={({ field: inputField }) => {
                                    const expiresAtWarning = undefined;
                                    const expiresAtMessage =
                                      errors?.expiresAt?.message ??
                                      expiresAtWarning;

                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="block w-full">
                                            <DatePickerInput
                                              aria-label={`Ngày hết hạn dòng ${index + 1}`}
                                              aria-invalid={!!errors?.expiresAt}
                                              calendarLabel={`Chọn ngày hết hạn dòng ${index + 1}`}
                                              value={inputField.value}
                                              valueMode="iso-date"
                                              variant="md"
                                              onBlur={inputField.onBlur}
                                              onChange={inputField.onChange}
                                            />
                                          </span>
                                        </TooltipTrigger>
                                        {expiresAtMessage && (
                                          <TooltipContent
                                            variant={
                                              errors?.expiresAt
                                                ? 'destructive'
                                                : 'warning'
                                            }
                                          >
                                            {expiresAtMessage}
                                          </TooltipContent>
                                        )}
                                      </Tooltip>
                                    );
                                  }}
                                />
                              </TableCell>
                              <TableCell className="sticky right-0 z-10 bg-card px-3 py-2 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    aria-label={`Xóa dòng ${index + 1}`}
                                    title="Xóa"
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
                  <TableRow>
                    <TableCell colSpan={8} className="px-2 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddRow}
                      >
                        <Plus />
                        Thêm tài khoản
                      </Button>
                    </TableCell>
                  </TableRow>
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
