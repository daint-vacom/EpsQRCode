import { describe, expect, it } from 'vitest';
import {
  getGlobalSearchResultPath,
  GLOBAL_SEARCH_LIMIT_PER_SOURCE,
  type GlobalSearchItem,
} from './global-search';

const item: GlobalSearchItem = {
  id: 'record-1',
  title: 'Công ty Mẫu',
  code: 'KH 01/2026',
  subtitle: null,
  status: null,
  imageUrl: null,
};

describe('global search model', () => {
  it('keeps the per-source result limit at five', () => {
    expect(GLOBAL_SEARCH_LIMIT_PER_SOURCE).toBe(5);
  });

  it('builds a searchable employee list route', () => {
    expect(getGlobalSearchResultPath('employees', item)).toBe(
      '/employees?search=KH%2001%2F2026',
    );
  });
});
