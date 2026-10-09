import { vi } from './messages/vi';

export const LOCALES = ['vi'] as const;
export type Locale = (typeof LOCALES)[number];

export const messagesByLocale: Record<Locale, Record<string, string>> = {
  vi,
};

/** UI mặc định là tiếng Việt (xem docs/02). Thêm message theo namespace `feature.key`. */
export const DEFAULT_LOCALE: Locale = 'vi';
