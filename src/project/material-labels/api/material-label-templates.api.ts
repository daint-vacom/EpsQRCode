import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type {
  MaterialLabelTemplate,
  MaterialLabelTemplateInput,
  MaterialLabelTemplatePreference,
} from '../model/material-label-template';

type MaterialLabelTemplatesResponse = { items: MaterialLabelTemplate[] };

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadMaterialLabelTemplates(
  signal?: AbortSignal,
): Promise<MaterialLabelTemplate[]> {
  assertSupabaseConfigured();
  const result = await request<MaterialLabelTemplatesResponse>(
    supabaseApi.post('/rpc/list_material_label_templates', {}, { signal }),
  );
  return result.items;
}

export async function saveMaterialLabelTemplate(
  input: MaterialLabelTemplateInput,
): Promise<MaterialLabelTemplate> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post('/rpc/save_material_label_template', {
      p_id: input.id,
      p_payload: {
        name: input.name,
        description: input.description,
        widthMm: input.widthMm,
        heightMm: input.heightMm,
        design: input.design,
        isDefault: input.isDefault,
        isActive: input.isActive,
      },
    }),
  );
}

export async function loadMaterialLabelTemplatePreferences(
  materialIds: string[],
  signal?: AbortSignal,
): Promise<MaterialLabelTemplatePreference[]> {
  assertSupabaseConfigured();
  return request(
    supabaseApi.post(
      '/rpc/list_material_label_template_preferences',
      { p_material_ids: materialIds },
      { signal },
    ),
  );
}

export async function saveMaterialLabelTemplatePreferences(
  materialIds: string[],
  templateId: string,
): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.post('/rpc/save_material_label_template_preferences', {
      p_material_ids: materialIds,
      p_template_id: templateId,
    }),
  );
}
