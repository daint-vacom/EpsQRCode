import { useEffect, type ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import { setValidationLocale } from '@/lib/validation';
import { DEFAULT_LOCALE, messagesByLocale } from './config';

/** Bọc ứng dụng bằng react-intl với catalog tiếng Việt. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = DEFAULT_LOCALE;

  useEffect(() => {
    setValidationLocale(locale);
  }, [locale]);

  return (
    <IntlProvider
      locale={locale}
      defaultLocale={DEFAULT_LOCALE}
      messages={messagesByLocale[locale]}
    >
      {children}
    </IntlProvider>
  );
}
