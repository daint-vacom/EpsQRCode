import { useIntl } from 'react-intl';
import { SelectionActionBar } from '@/components/ui/selection-action-bar';

export function MaterialSpecificationsActionBar({
  selectedCount,
  allowCopy = true,
  action,
  onActionChange,
  onApply,
  applyDisabled,
  onClear,
}: {
  selectedCount: number;
  allowCopy?: boolean;
  action: string;
  onActionChange: (value: string) => void;
  onApply: (action: string) => void;
  applyDisabled: boolean;
  onClear: () => void;
}) {
  const intl = useIntl();
  if (selectedCount === 0) return null;

  const actions = [
    ...(allowCopy
      ? [
          {
            value: 'copy',
            label: intl.formatMessage({
              id: 'materialModels.specifications.selection.copy',
            }),
            icon: 'copy' as const,
          },
        ]
      : []),
    {
      value: 'delete',
      label: intl.formatMessage({
        id: 'materialModels.specifications.selection.delete',
      }),
      icon: 'delete' as const,
      destructive: true,
    },
  ];

  return (
    <SelectionActionBar
      ariaLabel={intl.formatMessage({
        id: 'materialModels.specifications.selection.toolbar',
      })}
      selectionLabel={intl.formatMessage(
        { id: 'materialModels.specifications.selection.selected' },
        { count: selectedCount },
      )}
      actionLabel={intl.formatMessage({
        id: 'project.materials.bulk.chooseAction',
      })}
      actionPlaceholder={intl.formatMessage({
        id: 'project.materials.bulk.chooseAction',
      })}
      actions={actions}
      action={action}
      onActionChange={onActionChange}
      applyLabel={intl.formatMessage({ id: 'project.materials.bulk.apply' })}
      onApply={onApply}
      applyDisabled={applyDisabled}
      onClear={onClear}
      clearLabel={intl.formatMessage({
        id: 'materialModels.specifications.selection.clear',
      })}
    />
  );
}
