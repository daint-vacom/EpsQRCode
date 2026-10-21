import { z } from 'zod';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string;
  accountUserIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseAccountOption {
  id: string;
  username: string | null;
  displayName: string;
}

export const warehouseFormSchema = z.object({
  code: z.string().trim().min(1, 'Vui lòng nhập mã kho.'),
  name: z.string().trim().min(1, 'Vui lòng nhập tên kho.'),
  address: z.string().trim(),
  accountUserIds: z.array(z.string()),
  isActive: z.boolean(),
});

export type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

export const WAREHOUSE_PERMISSION_CODES = {
  view: 'materials:warehouse:view',
  manage: 'materials:warehouse:manage',
} as const;
