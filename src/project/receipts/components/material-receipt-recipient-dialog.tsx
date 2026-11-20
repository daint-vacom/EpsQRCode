import { useMemo } from 'react';
import type { Custodian } from '@/project/custodians/model/custodian';
import { HandoverPartyDialog } from '@/project/handover/components/handover-party-dialog';
import type { HandoverFormValues } from '@/project/handover/model/handover';
import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { ErrorState } from '@/components/ui/error-state';
import type { SelectOption } from '@/components/ui/option-select';
import { MaterialReceiptRecipientDialogShell } from './material-receipt-recipient-dialog-shell.generated';

interface MaterialReceiptRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  options: SelectOption<Custodian>[];
  loading: boolean;
  error?: string;
  onRetry: () => void;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function MaterialReceiptRecipientDialog({
  open,
  onOpenChange,
  value,
  options,
  loading,
  error,
  onRetry,
  disabled = false,
  onChange,
}: MaterialReceiptRecipientDialogProps) {
  const intl = useIntl();
  const handoverForm = useForm<HandoverFormValues>();
  const parties = useMemo(
    () => options.flatMap((option) => (option.data ? [option.data] : [])),
    [options],
  );

  if (loading || error) {
    return (
      <MaterialReceiptRecipientDialogShell
        open={open}
        onOpenChange={onOpenChange}
      >
        {error ? (
          <ErrorState
            title={intl.formatMessage({ id: 'receipts.errors.loadRecipients' })}
            description={error}
            onRetry={onRetry}
          />
        ) : (
          <div
            className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
            role="status"
          >
            <LoaderCircle className="size-4 animate-spin" />
            {intl.formatMessage({ id: 'common.state.loading' })}
          </div>
        )}
      </MaterialReceiptRecipientDialogShell>
    );
  }

  return (
    <HandoverPartyDialog
      open={open}
      onOpenChange={onOpenChange}
      side="recipient"
      form={handoverForm}
      parties={parties}
      selectionOnly
      initialPartyId={value}
      allowedKinds={['eps', 'external']}
      disabled={disabled}
      onSelectPartyId={onChange}
    />
  );
}
