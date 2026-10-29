import { z } from 'zod';
import { identifierSchema } from '../shared/schema-primitives';

const buttonVariantSchema = z.enum([
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
]);

const dialogActionSchema = z.object({
  name: identifierSchema,
  label: z.string().min(1),
  labelMessageId: z.string().min(1).optional(),
  variant: buttonVariantSchema.default('primary'),
  type: z.enum(['button', 'submit']).default('button'),
  icon: identifierSchema.optional(),
  loadingProp: identifierSchema.optional(),
  loadingText: z.string().optional(),
  loadingMessageId: z.string().min(1).optional(),
  disabledProp: identifierSchema.optional(),
  disabledWhen: z.enum(['truthy', 'falsy']).default('truthy'),
  className: z.string().optional(),
});

export const dialogSpecSchema = z
  .object({
    componentName: identifierSchema,
    title: z.string().min(1),
    titleMessageId: z.string().min(1).optional(),
    titleProp: identifierSchema.optional(),
    description: z.string().optional(),
    descriptionMessageId: z.string().min(1).optional(),
    width: z
      .enum(['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'])
      .default('lg'),
    specPath: z.string().optional(),
    actions: z.array(dialogActionSchema).max(4).default([]),
  })
  .superRefine((spec, ctx) => {
    const names = new Set<string>();
    spec.actions.forEach((action, index) => {
      if (names.has(action.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'action name bị trùng: ' + action.name,
          path: ['actions', index, 'name'],
        });
      }
      names.add(action.name);

      if (action.loadingText && !action.loadingProp) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'loadingText cần có loadingProp tương ứng',
          path: ['actions', index, 'loadingText'],
        });
      }
    });
  });

export type DialogActionSpec = z.infer<typeof dialogActionSchema>;
export type DialogSpec = z.input<typeof dialogSpecSchema>;
export type ResolvedDialogSpec = z.output<typeof dialogSpecSchema>;
