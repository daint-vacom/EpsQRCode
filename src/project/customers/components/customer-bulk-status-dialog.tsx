import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUSES,
  type CustomerStatus,
} from '../model/customer';
import { CustomerBulkStatusDialogShell } from './customer-bulk-status-dialog-shell.generated';

interface CustomerBulkStatusDialogProps {
  open: boolean;
  customerCount: number;
  isSaving?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (status: CustomerStatus) => void;
}

export function CustomerBulkStatusDialog({
  open,
  customerCount,
  isSaving = false,
  onOpenChange,
  onConfirm,
}: CustomerBulkStatusDialogProps) {
  const [status, setStatus] = useState<CustomerStatus>('active');

  useEffect(() => {
    if (open) setStatus('active');
  }, [customerCount, open]);

  return (
    <CustomerBulkStatusDialogShell
      open={open}
      onOpenChange={onOpenChange}
      dialogTitle={`Cập nhật trạng thái cho ${customerCount} khách hàng`}
      isSaving={isSaving}
      canConfirm={customerCount > 0}
      onCancel={() => onOpenChange(false)}
      onConfirm={() => onConfirm(status)}
    >
      <div className="grid gap-2">
        <label className="text-sm font-medium text-foreground">
          Trạng thái
        </label>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as CustomerStatus)}
        >
          <SelectTrigger aria-label="Trạng thái khách hàng">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CUSTOMER_STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {CUSTOMER_STATUS_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </CustomerBulkStatusDialogShell>
  );
}
