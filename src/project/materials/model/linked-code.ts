import { z } from 'zod';
import { formatMessage } from '@/lib/validation';

export const linkedCodeSchema = z
  .object({
    label: z.string().trim(),
    value: z.string().trim(),
  })
  .superRefine((code, context) => {
    if (Boolean(code.label) !== Boolean(code.value)) {
      context.addIssue({
        code: 'custom',
        path: [code.label ? 'value' : 'label'],
        message: formatMessage('project.materials.linkedCodes.pairRequired'),
      });
    }
  });

export type LinkedCode = z.infer<typeof linkedCodeSchema>;

export const linkedCodesSchema = z
  .array(linkedCodeSchema)
  .superRefine((codes, context) => {
    const values = new Set<string>();
    codes.forEach((code, index) => {
      const normalizedValue = code.value.trim().toLocaleLowerCase();
      if (!normalizedValue) return;
      if (values.has(normalizedValue)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'value'],
          message: formatMessage(
            'project.materials.linkedCodes.duplicateValue',
          ),
        });
      }
      values.add(normalizedValue);
    });
  });

export function normalizeLinkedCodes(codes: LinkedCode[]): LinkedCode[] {
  return codes
    .map((code) => ({ label: code.label.trim(), value: code.value.trim() }))
    .filter((code) => code.label && code.value);
}
