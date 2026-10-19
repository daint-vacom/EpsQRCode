import { z } from 'zod';
import {
  apiSearchSelectFieldControlSchema,
  autocompleteFieldControlSchema,
  comboboxFieldControlSchema,
  dateFieldControlSchema,
  imageFieldControlSchema,
  inputSelectFieldControlSchema,
  multiselectFieldControlSchema,
  numberFieldControlSchema,
  searchSelectFieldControlSchema,
  selectFieldControlSchema,
  switchFieldControlSchema,
  tagSelectFieldControlSchema,
  textareaFieldControlSchema,
  textFieldControlSchema,
} from '../shared/form-field-spec';
import { identifierSchema } from '../shared/schema-primitives';

/**
 * Spec schema for the form/dialog builder. A `FormSpec` is the **projection** of
 * an entity's create/edit schema into a responsive form. The builder emits both a
 * reusable inline `<Entity>Form` and a thin `<Entity>FormDialog` wrapper
 * (react-hook-form + zodResolver + `src/components/ui` inputs) on a 12-col grid.
 *
 * Layout: each field has a width preset (`normal` = half row, `large` = 2/3,
 * `full` = whole row); omitted widths default to `full`, and on mobile every
 * field stacks full-width.
 */

const fieldName = identifierSchema;
const formModes = z
  .array(z.enum(['create', 'edit']))
  .min(1)
  .max(2)
  .optional();

/** Width presets → column span on the desktop 12-col grid. */
export const FORM_WIDTHS = ['normal', 'large', 'full'] as const;
const width = z.enum(FORM_WIDTHS).optional();

/** Shared FormItem layout presets for fields that align labels beside controls. */
export const FORM_ITEM_LAYOUTS = ['stacked', 'horizontal'] as const;
export const FORM_ITEM_LABEL_WIDTHS = ['sm', 'md', 'lg'] as const;
export const FORM_ITEM_LABEL_GAPS = ['sm', 'md', 'lg'] as const;
const itemLayout = z.enum(FORM_ITEM_LAYOUTS).optional();
const itemLabelWidth = z.enum(FORM_ITEM_LABEL_WIDTHS).optional();
const itemLabelGap = z.enum(FORM_ITEM_LABEL_GAPS).optional();
const itemAlignment = z.enum(['center', 'start', 'first-control']).optional();

const base = {
  name: fieldName,
  label: z.string().min(1),
  /** Optional react-intl message ID used instead of the literal label. */
  labelMessageId: z.string().min(1).optional(),
  width,
  layout: itemLayout,
  labelWidth: itemLabelWidth,
  labelGap: itemLabelGap,
  alignment: itemAlignment,
  /** Start this field at the first desktop grid column, leaving the previous row's remainder empty. */
  breakBefore: z.boolean().optional(),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  /** Restrict this field to one dialog mode; omitted means both modes. */
  modes: formModes,
};

const textField = textFieldControlSchema.extend(base);

const imageField = imageFieldControlSchema.extend(base);

const numberField = numberFieldControlSchema.extend(base);

const dateField = dateFieldControlSchema.extend(base);

const textareaField = textareaFieldControlSchema.extend(base);

const selectField = selectFieldControlSchema.extend(base);

const comboboxField = comboboxFieldControlSchema.extend(base);

const autocompleteField = autocompleteFieldControlSchema.extend(base);

const searchSelectField = searchSelectFieldControlSchema.extend(base);

const apiSearchSelectField = apiSearchSelectFieldControlSchema.extend(base);

const inputSelectField = inputSelectFieldControlSchema.extend(base);

const multiselectField = multiselectFieldControlSchema.extend(base);

const tagSelectField = tagSelectFieldControlSchema.extend(base);

const switchField = switchFieldControlSchema.extend(base);

export const formFieldSchema = z.discriminatedUnion('kind', [
  textField,
  imageField,
  numberField,
  dateField,
  textareaField,
  selectField,
  comboboxField,
  autocompleteField,
  searchSelectField,
  apiSearchSelectField,
  inputSelectField,
  multiselectField,
  tagSelectField,
  switchField,
]);

export const formSpecSchema = z
  .object({
    /** Entity name, e.g. `Supplier` → component `SupplierFormDialog`. */
    entity: identifierSchema,
    /** Import specifier for the schema module. */
    schemaImport: z.string().min(1),
    /** Exported zod schema name used as the resolver. */
    schemaName: identifierSchema,
    /** Exported inferred values type name. */
    valuesType: identifierSchema,
    /** Dialog title + optional description (Vietnamese). */
    title: z.string().min(1),
    /** Optional react-intl message ID used instead of the literal title. */
    titleMessageId: z.string().min(1).optional(),
    description: z.string().optional(),
    /** Optional react-intl message ID used instead of the literal description. */
    descriptionMessageId: z.string().min(1).optional(),
    /** Component name; defaults to `<Entity>FormDialog`. */
    componentName: identifierSchema.optional(),
    /** Spec path recorded in the provenance banner. */
    specPath: z.string().optional(),
    fields: z.array(formFieldSchema).min(1, 'cần ít nhất một trường'),
  })
  .superRefine((spec, ctx) => {
    spec.fields.forEach((field, index) => {
      if (
        (field.kind === 'select' ||
          field.kind === 'combobox' ||
          field.kind === 'autocomplete' ||
          field.kind === 'searchSelect' ||
          field.kind === 'multiselect') &&
        field.optionsFrom !== 'prop' &&
        (!field.options || field.options.length < 1)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Trường dùng options tĩnh cần khai báo ít nhất một lựa chọn',
          path: ['fields', index, 'options'],
        });
      }

      if (
        field.kind === 'inputSelect' &&
        field.selectOptionsFrom !== 'prop' &&
        (!field.selectOptions || field.selectOptions.length < 1)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Input ghép dùng options tĩnh cần khai báo ít nhất một lựa chọn',
          path: ['fields', index, 'selectOptions'],
        });
      }

      if (
        field.kind === 'inputSelect' &&
        (field.selectName === field.name ||
          spec.fields.some(
            (candidate, candidateIndex) =>
              candidateIndex !== index && candidate.name === field.selectName,
          ))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'selectName phải là một field phụ chưa được khai báo riêng',
          path: ['fields', index, 'selectName'],
        });
      }
    });
  });

export type FormFieldSpec = z.infer<typeof formFieldSchema>;
export type FormSpec = z.infer<typeof formSpecSchema>;
export type FormFieldKind = FormFieldSpec['kind'];
