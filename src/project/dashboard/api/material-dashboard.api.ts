import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import type { MaterialDashboardSummary } from '../model/material-dashboard';

export async function loadMaterialDashboardSummary(
  endMonth: string,
  signal?: AbortSignal,
): Promise<MaterialDashboardSummary> {
  assertSupabaseConfigured();
  return (await supabaseApi.post(
    '/rpc/get_material_dashboard_summary',
    { p_end_month: endMonth },
    { signal },
  )) as MaterialDashboardSummary;
}
