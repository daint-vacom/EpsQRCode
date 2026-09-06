import { useCallback, useState } from 'react';
import { getStorageItem, setStorageItem } from '@/lib/storage';

export function usePersistedBoolean(
  storageKey: string | undefined,
  defaultValue = false,
): {
  value: boolean;
  onValueChange: (value: boolean) => void;
} {
  const [value, setValue] = useState<boolean>(() => {
    if (!storageKey) return defaultValue;

    const stored = getStorageItem<boolean>(storageKey);
    return typeof stored === 'boolean' ? stored : defaultValue;
  });

  const onValueChange = useCallback(
    (nextValue: boolean) => {
      setValue(nextValue);
      if (storageKey) setStorageItem(storageKey, nextValue);
    },
    [storageKey],
  );

  return { value, onValueChange };
}
