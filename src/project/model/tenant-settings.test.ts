import { describe, expect, it } from 'vitest';
import { mapTenantSettingsRow } from './tenant-settings';

describe('mapTenantSettingsRow', () => {
  it('uses the tenant currency and formats as defaults when settings are absent', () => {
    const values = mapTenantSettingsRow({
      id: 'tenant-1',
      name: 'Tenant',
      legal_name: null,
      logo_url: null,
      default_currency_code: 'USD',
      settings: {},
    });

    expect(values.currencyCode).toBe('USD');
    expect(values.numberLocale).toBe('vi-VN');
    expect(values.compactDisplay).toBe('long');
  });
});
