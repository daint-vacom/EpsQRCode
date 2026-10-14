/**
 * Scaffolded by form-builder from `src/examples/material/models/form/material-model.form.fixture.ts`. Run `npm run gen:form` — do NOT hand-write this file.
 * You own this file now — wire submit + edit reset behavior in the parent. To change fields,
 * widths or layout, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated options consts — that's how review detects a bypassed builder.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { UseFormProps, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { ExampleMaterialModel } from '../../model/material-model';
import {
  exampleMaterialModelFormSchema,
  type ExampleMaterialModelFormValues,
} from '../material-model.schema';

export const exampleMaterialModelDefaultValues: ExampleMaterialModelFormValues =
  {
    name: '',
    code: '',
    groupId: '',
    origin: '',
    description: '',
    isSafetyManaged: false,
    inspectionTableId: '',
    imageUrls: [],
    specs: [],
  };

type ExampleMaterialModelFormSource = ExampleMaterialModel;

export function useExampleMaterialModelForm(
  options?: Omit<UseFormProps<ExampleMaterialModelFormValues>, 'resolver'>,
) {
  return useForm<ExampleMaterialModelFormValues>({
    resolver: zodResolver(exampleMaterialModelFormSchema),
    defaultValues: exampleMaterialModelDefaultValues,
    ...options,
  });
}

export function mapExampleMaterialModelToFormValues(
  entity: ExampleMaterialModelFormSource,
): ExampleMaterialModelFormValues {
  return {
    name: entity.name,
    code: entity.code,
    groupId: entity.groupId,
    origin: entity.origin ?? '',
    description: entity.description ?? '',
    isSafetyManaged: entity.isSafetyManaged ?? false,
    inspectionTableId: entity.inspectionTableId ?? '',
    imageUrls: entity.imageUrls,
    specs: entity.specs
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((spec) => ({
        id: spec.id,
        source: spec.source,
        specDefinitionId: spec.specDefinitionId,
        customDefinition: spec.customDefinition,
        labelOverride: spec.labelOverride,
        partKey: spec.partKey,
        selectionModeOverride: spec.selectionModeOverride,
        valueSetIdOverride: spec.valueSetIdOverride,
        optionSource: spec.optionSource,
        materialValueMode: spec.materialValueMode,
        defaultValue: spec.defaultValue,
        isRequired: spec.isRequired,
      })),
  };
}

interface ExampleMaterialModelFormProps {
  form: UseFormReturn<ExampleMaterialModelFormValues>;
  onSubmit: (values: ExampleMaterialModelFormValues) => void;
  id?: string;
  groupIdOptions: { value: string; label: string }[];
  inspectionTableIdOptions: { value: string; label: string }[];
}

export function ExampleMaterialModelForm({
  form,
  onSubmit,
  id = 'exampleMaterialModel-form',
  groupIdOptions,
  inspectionTableIdOptions,
}: ExampleMaterialModelFormProps) {
  const isSafetyManaged = form.watch('isSafetyManaged');

  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-12">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  Tên mẫu<span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="vd: iPhone 17 Pro"
                    variant="md"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  Mã mẫu<span className="text-destructive"> *</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="vd: MAU-IP17PRO"
                    variant="md"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="groupId"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>
                  Nhóm vật tư<span className="text-destructive"> *</span>
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn nhóm" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {groupIdOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="origin"
            render={({ field }) => (
              <FormItem className="md:col-span-6">
                <FormLabel>Xuất xứ</FormLabel>
                <FormControl>
                  <Input placeholder="vd: Trung Quốc" variant="md" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>Mô tả</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="imageUrls"
            render={({ field }) => (
              <FormItem className="md:col-span-12">
                <FormLabel>Ảnh đại diện (đường dẫn ảnh)</FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    value={field.value[0] ?? ''}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value ? [event.target.value] : [],
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
                {field.value[0] ? (
                  <img
                    src={field.value[0]}
                    alt="Ảnh mẫu vật tư"
                    className="mt-2 size-20 rounded-admin-control border border-border object-cover"
                  />
                ) : null}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isSafetyManaged"
            render={({ field }) => (
              <FormItem className="md:col-span-12 flex-row items-center gap-2.5">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="font-normal text-foreground">
                  Quản lý an toàn
                </FormLabel>
              </FormItem>
            )}
          />

          {isSafetyManaged && (
            <div className="md:col-span-12 flex flex-col gap-3">
              <FormField
                control={form.control}
                name="inspectionTableId"
                render={({ field }) => (
                  <FormItem className="max-w-xl">
                    <FormLabel>Bảng kiểm định</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn bảng kiểm định" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {inspectionTableIdOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>
      </form>
    </Form>
  );
}

interface ExampleMaterialModelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<ExampleMaterialModelFormValues>;
  onSubmit: (values: ExampleMaterialModelFormValues) => void;
  title?: string;
  groupIdOptions: { value: string; label: string }[];
  inspectionTableIdOptions: { value: string; label: string }[];
}

export function ExampleMaterialModelFormDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
  title,
  groupIdOptions,
  inspectionTableIdOptions,
}: ExampleMaterialModelFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 py-5 text-start">
          <DialogTitle>{title ?? 'Mẫu vật tư'}</DialogTitle>
          <DialogDescription>Thông tin cơ bản của mẫu.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <ExampleMaterialModelForm
            form={form}
            onSubmit={onSubmit}
            id="exampleMaterialModel-form"
            groupIdOptions={groupIdOptions}
            inspectionTableIdOptions={inspectionTableIdOptions}
          />
        </div>

        <DialogFooter className="shrink-0 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            variant="primary"
            form="exampleMaterialModel-form"
          >
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
