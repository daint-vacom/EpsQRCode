import { useCallback, useEffect, useState } from 'react';
import {
  MATERIAL_SPECIFICATIONS_CLIPBOARD_KEY,
  materialSpecificationsClipboardSchema,
} from '../model/material-specifications-clipboard';
import type { MaterialSpecificationsClipboard } from '../model/material-specifications-clipboard';

function readClipboard(): MaterialSpecificationsClipboard | null {
  try {
    const serialized = globalThis.localStorage.getItem(
      MATERIAL_SPECIFICATIONS_CLIPBOARD_KEY,
    );
    if (!serialized) return null;

    const parsed = materialSpecificationsClipboardSchema.safeParse(
      JSON.parse(serialized),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function useMaterialSpecificationsClipboard() {
  const [clipboard, setClipboard] = useState(readClipboard);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== MATERIAL_SPECIFICATIONS_CLIPBOARD_KEY
      ) {
        return;
      }
      setClipboard(readClipboard());
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const copy = useCallback((value: MaterialSpecificationsClipboard) => {
    const parsed = materialSpecificationsClipboardSchema.safeParse(value);
    if (!parsed.success) return false;

    try {
      globalThis.localStorage.setItem(
        MATERIAL_SPECIFICATIONS_CLIPBOARD_KEY,
        JSON.stringify(parsed.data),
      );
      setClipboard(parsed.data);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { clipboard, copy };
}
