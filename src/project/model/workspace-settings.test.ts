import { describe, expect, it } from 'vitest';
import { mapWorkspaceSettingsRow } from './workspace-settings';

describe('mapWorkspaceSettingsRow', () => {
  it('uses the workspace currency and formats as defaults when settings are absent', () => {
    const values = mapWorkspaceSettingsRow({
      id: 'workspace-1',
      name: 'Workspace',
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
