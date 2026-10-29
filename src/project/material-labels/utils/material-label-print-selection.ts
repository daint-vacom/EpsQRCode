const STORAGE_KEY_PREFIX = 'material-label-print-selection:';
export const MATERIAL_LABEL_SELECTION_STATE_KEY = 'materialLabelSelectionKey';

export function storeMaterialLabelSelection(
  ids: readonly string[],
  previousSelectionKey?: string,
): string {
  const selectionKey =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  window.sessionStorage.setItem(
    `${STORAGE_KEY_PREFIX}${selectionKey}`,
    JSON.stringify(uniqueIds),
  );
  if (previousSelectionKey && previousSelectionKey !== selectionKey) {
    window.sessionStorage.removeItem(
      `${STORAGE_KEY_PREFIX}${previousSelectionKey}`,
    );
  }
  return selectionKey;
}

export function readMaterialLabelSelection(selectionKey: string): string[] {
  if (!selectionKey) return [];

  try {
    const serialized = window.sessionStorage.getItem(
      `${STORAGE_KEY_PREFIX}${selectionKey}`,
    );
    const parsed: unknown = serialized ? JSON.parse(serialized) : [];
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter((id): id is string => typeof id === 'string' && id),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

export function getMaterialLabelSelectionKey(state: unknown): string {
  if (state === null || typeof state !== 'object') return '';
  const key = Reflect.get(state, MATERIAL_LABEL_SELECTION_STATE_KEY);
  return typeof key === 'string' ? key : '';
}
