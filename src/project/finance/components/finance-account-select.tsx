import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Landmark, WalletCards } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  OptionSelect,
  type OptionSelectProps,
  type SelectOption,
} from '@/components/ui/option-select';
import type { FinanceAccount, FinanceAccountType } from '../model/finance';
import { FinanceAccountStatusBadge } from './finance-account-status-badge';

export const FINANCE_ACCOUNT_TYPE_ICON_CONFIG: Record<
  FinanceAccountType,
  { label: string; icon: LucideIcon; className: string }
> = {
  cash: {
    label: 'Tiền mặt',
    icon: WalletCards,
    className: 'bg-admin-amber-bg text-admin-amber-primary',
  },
  bank: {
    label: 'Ngân hàng',
    icon: Landmark,
    className: 'bg-admin-blue-bg text-admin-blue-primary',
  },
};

function FinanceAccountIdentity({ account }: { account: FinanceAccount }) {
  const typeConfig = FINANCE_ACCOUNT_TYPE_ICON_CONFIG[account.accountType];
  const TypeIcon = typeConfig.icon;

  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9 shrink-0 rounded-lg">
        <AvatarFallback className={cn('rounded-lg', typeConfig.className)}>
          <TypeIcon className="size-4" />
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-sm font-semibold leading-5 text-foreground">
          {account.name}
        </span>
        <span className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground">
          {account.code} · {typeConfig.label}
        </span>
      </span>
      <span className="ms-auto shrink-0">
        <FinanceAccountStatusBadge isActive={account.isActive} />
      </span>
    </span>
  );
}

function toOption(account: FinanceAccount): SelectOption<FinanceAccount> {
  return {
    value: account.id,
    label: <FinanceAccountIdentity account={account} />,
    searchableText: [
      account.name,
      account.code,
      account.bankName,
      account.bankAccountNumber,
      FINANCE_ACCOUNT_TYPE_ICON_CONFIG[account.accountType].label,
    ]
      .filter(Boolean)
      .join(' '),
    data: account,
  };
}

export interface FinanceAccountSelectProps extends Omit<
  OptionSelectProps<FinanceAccount>,
  | 'options'
  | 'loading'
  | 'loadingMessage'
  | 'onSelect'
  | 'selectedOption'
  | 'renderOption'
  | 'triggerContent'
> {
  accounts: readonly FinanceAccount[];
  loading?: boolean;
  loadingMessage?: string;
  onSelect?: (account: FinanceAccount | undefined) => void;
}

export function FinanceAccountSelect({
  accounts,
  loading = false,
  loadingMessage = 'Đang tải danh sách quỹ/tài khoản...',
  emptyMessage = 'Không tìm thấy quỹ/tài khoản',
  value = '',
  placeholder = 'Chọn quỹ / tài khoản',
  searchPlaceholder = 'Tìm quỹ/tài khoản...',
  className,
  onSelect,
  ...props
}: FinanceAccountSelectProps) {
  const options = useMemo(() => accounts.map(toOption), [accounts]);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  return (
    <OptionSelect
      {...props}
      value={value}
      options={options}
      selectedOption={selectedOption}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      loading={loading}
      loadingMessage={loadingMessage}
      renderOption={(option) => option.label}
      triggerContent={(option) => option?.label ?? placeholder}
      className={cn(
        'h-auto min-h-14 border-transparent bg-transparent py-2 shadow-none hover:bg-accent data-[state=open]:bg-accent',
        className,
      )}
      onSelect={(option) => onSelect?.(option?.data)}
    />
  );
}
