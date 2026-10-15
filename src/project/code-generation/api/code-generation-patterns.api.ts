import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';

export type CodeGenerationEntityKey =
  'material_group' | 'material_model' | 'material_specification';

export interface CodeGenerationPattern {
  entityKey: CodeGenerationEntityKey;
  pattern: string;
  updatedAt: string;
}

interface CodeGenerationPatternRow {
  entity_key: CodeGenerationEntityKey;
  pattern: string;
  updated_at: string;
}

async function request<T>(promise: Promise<unknown>): Promise<T> {
  return (await promise) as T;
}

export async function loadCodeGenerationPatterns(
  signal?: AbortSignal,
): Promise<CodeGenerationPattern[]> {
  assertSupabaseConfigured();
  const rows = await request<CodeGenerationPatternRow[]>(
    supabaseApi.get('/code_generation_patterns', {
      params: {
        select: 'entity_key,pattern,updated_at',
        order: 'entity_key.asc',
      },
      signal,
    }),
  );
  return rows.map((row) => ({
    entityKey: row.entity_key,
    pattern: row.pattern,
    updatedAt: row.updated_at,
  }));
}

export async function saveCodeGenerationPatterns(
  patterns: Pick<CodeGenerationPattern, 'entityKey' | 'pattern'>[],
): Promise<void> {
  assertSupabaseConfigured();
  await request(
    supabaseApi.post('/rpc/save_code_generation_patterns', {
      p_patterns: patterns.map((pattern) => ({
        entity_key: pattern.entityKey,
        pattern: pattern.pattern.trim(),
      })),
    }),
  );
}
