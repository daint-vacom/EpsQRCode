import type { ReactNode } from 'react';
import { vi as messagesVi } from '@/i18n/messages/vi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import { SafetyInspectionTypeConfigs } from './safety-inspection-type-configs';

const mocks = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue('type-1'),
  refetch: vi.fn(),
  preview: {
    token: 'preview-token-1',
    total: 1,
    items: [
      {
        materialId: 'material-1',
        code: 'MAT-001',
        name: 'Máy đo',
        anchorDate: '2026-10-01',
        lastCompletedAt: '2026-10-01T00:00:00Z',
        oldDueDate: '2026-11-01',
        newDueDate: '2026-12-01',
      },
    ],
  },
}));

vi.mock('../hooks/use-safety-inspection-type-configs', () => ({
  useSafetyInspectionTypeConfigsQuery: () => ({
    data: [
      {
        typeId: 'type-1',
        typeName: 'Kiểm tra định kỳ',
        checklist: [
          {
            id: 'g1',
            name: 'Nhóm',
            criteria: [{ id: 'c1', content: 'Kiểm tra' }],
          },
        ],
        intervalValue: 1,
        intervalUnit: 'month',
        enabled: true,
        startsOn: '2026-10-01',
        sourceKind: 'group',
        sourceId: 'scope-1',
        hasParent: true,
        directConfig: {
          nameOverride: null,
          checklist: null,
          checklistMode: 'replace',
          intervalValue: 1,
          intervalUnit: 'month',
          enabled: true,
          startsOn: '2026-10-01',
        },
      },
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useSaveSafetyInspectionTypeConfigMutation: () => ({
    mutateAsync: mocks.save,
    isPending: false,
    isError: false,
    reset: vi.fn(),
  }),
  useSafetyInspectionSchedulePreviewQuery: (...args: unknown[]) => ({
    data: args[5] ? mocks.preview : undefined,
    isPending: false,
    isError: false,
    refetch: mocks.refetch,
  }),
}));

vi.mock('./safety-inspection-type-config-table', () => ({
  SafetyInspectionTypeConfigTable: ({
    onEdit,
  }: {
    onEdit?: (item: unknown) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onEdit?.({
          typeId: 'type-1',
          typeName: 'Kiểm tra định kỳ',
          checklist: [
            {
              id: 'g1',
              name: 'Nhóm',
              criteria: [{ id: 'c1', content: 'Kiểm tra' }],
            },
          ],
          intervalValue: 1,
          intervalUnit: 'month',
          enabled: true,
          startsOn: '2026-10-01',
          sourceKind: 'group',
          sourceId: 'scope-1',
          hasParent: true,
          directConfig: {
            nameOverride: null,
            checklist: null,
            checklistMode: 'replace',
            intervalValue: 1,
            intervalUnit: 'month',
            enabled: true,
            startsOn: '2026-10-01',
          },
        })
      }
    >
      Edit type
    </button>
  ),
}));

vi.mock('./safety-inspection-type-config-dialog.generated', () => ({
  SafetyInspectionTypeConfigDialog: ({
    open,
    children,
    onCancel,
    onSave,
  }: {
    open: boolean;
    children: ReactNode;
    onCancel: () => void;
    onSave: () => void;
  }) =>
    open ? (
      <div role="dialog">
        {children}
        <button type="button" onClick={onCancel}>
          Cancel config
        </button>
        <button type="button" onClick={onSave}>
          Save config
        </button>
      </div>
    ) : null,
}));

function renderEditor() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <IntlProvider locale="vi" messages={messagesVi}>
      <QueryClientProvider client={client}>
        <SafetyInspectionTypeConfigs scopeKind="model" scopeId="scope-1" />
      </QueryClientProvider>
    </IntlProvider>,
  );
}

describe('SafetyInspectionTypeConfigs schedule preview', () => {
  it('starts unchecked, saves the preview token, and resets on reopen', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: 'Edit type' }));
    const recalculateLabel =
      'Tính lại hạn hiện tại cho các vật tư áp dụng chu kỳ này';
    const recalculate = screen.getByRole('checkbox', {
      name: recalculateLabel,
    });
    expect(recalculate).toHaveAttribute('aria-checked', 'false');

    await user.click(recalculate);
    expect(await screen.findByText('Máy đo')).toBeInTheDocument();
    expect(screen.getByText('2026-11-01 → 2026-12-01')).toBeInTheDocument();
    expect(
      screen.getByText('Xem trước hạn mới của 1 vật tư'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save config' }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          typeId: 'type-1',
          recalculate: true,
          expectedPreviewToken: 'preview-token-1',
        }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Edit type' }));
    expect(
      screen.getByRole('checkbox', { name: recalculateLabel }),
    ).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel config' }));
  });
});
