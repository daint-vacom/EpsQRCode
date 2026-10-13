import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  DEFAULT_NUMBER_FORMAT_COMPACT_DISPLAY,
  DEFAULT_NUMBER_FORMAT_CURRENCY_CODE,
  DEFAULT_NUMBER_FORMAT_LOCALE,
} from '@/project/model/workspace-settings';
import {
  createNumberFormatters,
  type NumberFormatSettings,
  type NumberFormatters,
} from '@/lib/format';

export interface NumberFormatContextValue extends NumberFormatters {
  currencyCode: string;
  isLoading: boolean;
  isError: boolean;
}

interface NumberFormatProviderProps {
  children: ReactNode;
  settings?: NumberFormatSettings;
}

const NumberFormatContext = createContext<NumberFormatContextValue | null>(
  null,
);

const fallbackFormatters = createNumberFormatters();

export function NumberFormatProvider({
  children,
  settings: settingsOverride,
}: NumberFormatProviderProps) {
  const settings = useMemo<NumberFormatSettings>(() => {
    if (settingsOverride) return settingsOverride;
    return {
      locale: DEFAULT_NUMBER_FORMAT_LOCALE,
      currencyCode: DEFAULT_NUMBER_FORMAT_CURRENCY_CODE,
      compactDisplay: DEFAULT_NUMBER_FORMAT_COMPACT_DISPLAY,
    };
  }, [settingsOverride]);

  const formatters = useMemo(
    () => createNumberFormatters(settings),
    [settings],
  );

  const value = useMemo<NumberFormatContextValue>(
    () => ({
      ...formatters,
      currencyCode: settings.currencyCode,
      isLoading: false,
      isError: false,
    }),
    [formatters, settings.currencyCode],
  );

  return (
    <NumberFormatContext.Provider value={value}>
      {children}
    </NumberFormatContext.Provider>
  );
}

export function useNumberFormat(): NumberFormatContextValue {
  const context = useContext(NumberFormatContext);
  if (context) return context;

  return {
    ...fallbackFormatters,
    currencyCode: fallbackFormatters.settings.currencyCode,
    isLoading: false,
    isError: false,
  };
}
