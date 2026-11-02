import { z } from 'zod';
import {
  autocompleteFieldControlSchema,
  dateFieldControlSchema,
  numberFieldControlSchema,
  textFieldControlSchema,
} from '../shared/form-field-spec';
import { identifierSchema, optionSchema } from '../shared/schema-primitives';

const identifier = identifierSchema;

const widthClass = z.string().min(1).optional();

const baseColumn = {
  id: identifier.optional(),
  header: z.string().min(1),
  widthClass,
};

const fieldColumnBase = {
  name: identifier,
  ariaLabel: z.string().optional(),
  warningExpression: z.string().optional(),
  ...baseColumn,
};

const indexColumn = z.object({
  kind: z.literal('index'),
  ...baseColumn,
});

const textColumn = textFieldControlSchema.extend({
  bulkEdit: z.boolean().default(false),
  ...fieldColumnBase,
});

const autocompleteColumn = autocompleteFieldControlSchema
  .extend({
    options: z.array(optionSchema).min(1),
  })
  .extend({
    bulkEdit: z.boolean().default(false),
    ...fieldColumnBase,
  });

const numberColumn = numberFieldControlSchema.extend({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  bulkEdit: z.boolean().default(false),
  ...fieldColumnBase,
});

const dateColumn = dateFieldControlSchema.extend({
  bulkEdit: z.boolean().default(false),
  ...fieldColumnBase,
});

const computedCurrencyColumn = z.object({
  kind: z.literal('computedCurrency'),
  id: identifier,
  header: z.string().min(1),
  widthClass,
});

/**
 * A feature-owned cell for compound controls or conditional row content.
 * The builder still owns the table lifecycle; the generated cell is an
 * explicit scaffold that the feature fills with its domain controls.
 */
const customColumn = z.object({
  kind: z.literal('custom'),
  id: identifier,
  header: z.string().min(1),
  widthClass,
});

export const editorTableColumnSchema = z.discriminatedUnion('kind', [
  indexColumn,
  textColumn,
  autocompleteColumn,
  numberColumn,
  dateColumn,
  computedCurrencyColumn,
  customColumn,
]);

export const editorTableSpecSchema = z.object({
  entity: identifier,
  componentName: identifier.optional(),
  modelImport: z.string().min(1),
  valuesType: identifier,
  valuesImport: z.string().min(1),
  arrayName: identifier,
  specPath: z.string().optional(),
  createRowProp: identifier.optional(),
  tableMinWidthClass: z.string().min(1).default('min-w-[1200px]'),
  /**
   * Optional self-contained header above the table (title + row count + an
   * "add row" button) so the component owns the single `useFieldArray` — the
   * page does not need its own array instance to add rows.
   */
  toolbar: z
    .object({
      title: z.string().min(1),
      titleProp: identifierSchema.optional(),
      addLabel: z.string().min(1).default('Thêm dòng'),
      addVariant: z
        .enum([
          'primary',
          'blue',
          'success',
          'info',
          'mono',
          'destructive',
          'secondary',
          'outline',
          'dashed',
          'ghost',
          'dim',
          'foreground',
          'inverse',
        ])
        .default('primary'),
      addShortcut: z.string().min(1).optional(),
      contentPosition: z.enum(['beforeAdd', 'afterAdd']).default('beforeAdd'),
    })
    .optional(),
  viewport: z
    .object({
      mode: z.enum(['fixed', 'remaining', 'natural']).default('fixed'),
      height: z.enum(['sm', 'md', 'lg']).optional(),
      className: z.string().optional(),
    })
    .default({ mode: 'fixed', height: 'lg' }),
  pagination: z
    .object({
      pageSize: z.number().int().positive().default(10),
      sizes: z.array(z.number().int().positive()).min(1).default([10, 25, 50]),
    })
    .optional(),
  multiEdit: z
    .object({
      enabled: z.boolean().default(false),
      actionBar: z.boolean().default(true),
      headerInputs: z.boolean().default(false),
      actions: z
        .array(z.enum(['copy', 'paste', 'delete']))
        .min(1)
        .default(['copy', 'delete']),
    })
    .default({
      enabled: false,
      actionBar: true,
      headerInputs: false,
      actions: ['copy', 'delete'],
    }),
  actions: z
    .object({
      enabled: z.boolean().default(true),
      header: z.string().optional(),
      widthClass: z.string().min(1).default('w-28'),
      duplicate: z.boolean().default(true),
      insert: z.boolean().default(true),
      delete: z.boolean().default(true),
    })
    .default({
      enabled: true,
      widthClass: 'w-28',
      duplicate: true,
      insert: true,
      delete: true,
    }),
  reorder: z
    .object({
      enabled: z.boolean().default(false),
      header: z.string().default('Thứ tự'),
      widthClass: z.string().min(1).default('w-12'),
    })
    .default({ enabled: false, header: 'Thứ tự', widthClass: 'w-12' }),
  columns: z
    .array(editorTableColumnSchema)
    .min(1, 'cần ít nhất một cột editor table'),
});

export type EditorTableColumnSpec = z.infer<typeof editorTableColumnSchema>;
export type EditorTableSpec = z.input<typeof editorTableSpecSchema>;
export type NormalizedEditorTableSpec = z.infer<typeof editorTableSpecSchema>;
