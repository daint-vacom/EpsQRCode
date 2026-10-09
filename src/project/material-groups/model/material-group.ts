import { z } from 'zod';

export const materialGroupFormSchema = z.object({
  code: z.string().trim().min(1, 'Vui lòng nhập mã nhóm.'),
  name: z.string().trim().min(1, 'Vui lòng nhập tên nhóm.'),
  description: z.string().trim(),
});

export type MaterialGroupFormValues = z.infer<typeof materialGroupFormSchema>;

export interface MaterialGroup {
  id: string;
  code: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialGroupRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function mapMaterialGroupRow(row: MaterialGroupRow): MaterialGroup {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
