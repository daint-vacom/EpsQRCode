import {
  materialModelSpecificationSchema,
  type MaterialModelSpecification,
} from '@/project/material-models/model/material-model';
import {
  safetyInspectionChecklistSchema,
  type SafetyInspectionChecklistGroup,
} from '@/project/material-safety-inspections/model/safety-inspection-checklist';
import { z } from 'zod';

export const materialGroupFormSchema = z.object({
  code: z.string().trim(),
  codeMode: z.enum(['auto', 'manual']),
  name: z.string().trim().min(1, 'Vui lòng nhập tên nhóm.'),
  description: z.string().trim(),
  specifications: z.array(materialModelSpecificationSchema),
  safetyInspectionChecklist: safetyInspectionChecklistSchema,
});

export type MaterialGroupFormValues = z.infer<typeof materialGroupFormSchema>;

export interface MaterialGroup {
  id: string;
  code: string;
  name: string;
  description: string;
  specifications: MaterialModelSpecification[];
  safetyInspectionChecklist?: SafetyInspectionChecklistGroup[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialGroupFilterSummary {
  total: number;
  active: number;
  inactive: number;
}

export interface MaterialGroupRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  specifications: MaterialModelSpecification[];
  safety_inspection_checklist?: SafetyInspectionChecklistGroup[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function mapMaterialGroupRow(row: MaterialGroupRow): MaterialGroup {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? '',
    specifications: row.specifications,
    safetyInspectionChecklist: row.safety_inspection_checklist ?? [],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
