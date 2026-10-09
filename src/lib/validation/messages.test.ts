import { DEFAULT_LOCALE } from '@/i18n/config';
import { describe, expect, it } from 'vitest';
import {
  formatMessage,
  setValidationLocale,
  syncValidationLocale,
} from './messages';

describe('validation message formatter', () => {
  it('formats Vietnamese catalog messages with params by default', () => {
    setValidationLocale(DEFAULT_LOCALE);

    expect(formatMessage('validation.string.min', { min: 3 })).toBe(
      'Tối thiểu 3 ký tự',
    );
  });

  it('falls back gracefully when a key is missing', () => {
    setValidationLocale(DEFAULT_LOCALE);

    expect(formatMessage('validation.unknown')).toBe('validation.unknown');
  });

  it('keeps validation messages in Vietnamese for unsupported locale values', () => {
    syncValidationLocale('en');

    expect(formatMessage('validation.number.max', { max: 10 })).toBe(
      'Tối đa là 10',
    );
    setValidationLocale(DEFAULT_LOCALE);
  });
});
