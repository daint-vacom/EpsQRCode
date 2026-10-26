import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import type { MultiSelectOption } from '@/components/ui/multi-select';
import {
  RepresentativeAssignmentFormDialog,
  useRepresentativeAssignmentForm,
} from '../forms/representative-assignment-form.generated';
import type { RepresentativeAccount } from '../model/custodian';

interface RepresentativeAccountsCellProps {
  entityName: string;
  value: string[];
  accounts: RepresentativeAccount[];
  canManage: boolean;
  isSaving: boolean;
  onSave: (userIds: string[]) => Promise<void>;
}

export function RepresentativeAccountsCell({
  entityName,
  value,
  accounts,
  canManage,
  isSaving,
  onSave,
}: RepresentativeAccountsCellProps) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const form = useRepresentativeAssignmentForm({
    defaultValues: { userIds: [] },
  });
  const options: MultiSelectOption[] = accounts.map((account) => ({
    value: account.id,
    label: account.displayName,
    searchableText: [account.displayName, account.username]
      .filter(Boolean)
      .join(' '),
  }));
  const selectedNames = value
    .map((id) => accounts.find((account) => account.id === id)?.displayName)
    .filter((name): name is string => Boolean(name));

  const openEditor = () => {
    if (!canManage) return;
    form.reset({ userIds: value });
    setOpen(true);
  };

  const submit = async ({ userIds }: { userIds: string[] }) => {
    try {
      await onSave(userIds);
      setOpen(false);
    } catch {
      // The owning page reports the normalized mutation error.
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canManage}
        onClick={openEditor}
        aria-label={intl.formatMessage(
          { id: 'custodians.representatives.actions.edit' },
          { name: entityName },
        )}
        className="h-auto min-h-8 w-full justify-between gap-2 whitespace-normal py-1.5 text-left font-normal"
      >
        <span className="min-w-0 flex-1 whitespace-normal break-words text-left">
          {selectedNames.length
            ? selectedNames.join(', ')
            : intl.formatMessage({
                id: 'custodians.representatives.empty',
              })}
        </span>
        {canManage ? <Pencil className="size-3.5 shrink-0" /> : null}
      </Button>
      <RepresentativeAssignmentFormDialog
        open={open}
        onOpenChange={setOpen}
        mode="edit"
        form={form}
        onSubmit={submit}
        isSaving={isSaving}
        userIdsOptions={options}
        title={intl.formatMessage(
          { id: 'custodians.representatives.dialog.entityTitle' },
          { name: entityName },
        )}
      />
    </>
  );
}
