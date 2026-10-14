import { z } from 'zod';

export const materialModelFormSchema = z.object({
  code: z.string().trim(),
  codeMode: z.enum(['auto', 'manual']),
  name: z.string().trim().min(1, 'Vui lòng nhập tên mẫu.'),
  imageUrl: z.union([z.literal(''), z.url('Đường dẫn ảnh không hợp lệ.')]),
  description: z.string().trim(),
});

export type MaterialModelFormValues = z.infer<typeof materialModelFormSchema>;

export interface MaterialModel {
  id: string;
  code: string;
  name: string;
  imageUrl: string | null;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialModelRow {
  id: string;
  code: string;
  name: string;
  image_url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function mapMaterialModelRow(row: MaterialModelRow): MaterialModel {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    imageUrl: row.image_url,
    description: row.description ?? '',
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
