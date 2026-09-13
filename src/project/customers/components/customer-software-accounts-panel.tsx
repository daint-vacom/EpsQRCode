import { useState } from 'react';
import { loadSoftwareAccountCatalogs } from '@/project/tags/api/software-account-catalog.api';
import type { SoftwareAccountCatalog } from '@/project/tags/model/software-account-catalog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardHeading,
  CardTable,
  CardTitle,
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataGridActionButton } from '@/components/ui/data-grid-columns';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { replaceCustomerSoftwareAccounts } from '../api/customers.api';
import type { CustomerSoftwareAccount } from '../model/customer';
import { CustomerSoftwareAccountDialog } from './customer-software-account-dialog';

function formatDate(value: string | null) {
  if (!value) return '';

  return new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`));
}

export function CustomerSoftwareAccountsPanel({
  tenantId,
  customerId,
  customerName,
  accounts,
  isLoading,
  error,
}: {
  tenantId: string;
  customerId: string;
  customerName: string;
  accounts: CustomerSoftwareAccount[];
  isLoading: boolean;
  error?: unknown;
}) {
  const queryClient = useQueryClient();
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<CustomerSoftwareAccount | null>(null);
  const [deletingAccount, setDeletingAccount] =
    useState<CustomerSoftwareAccount | null>(null);
  const softwareAccountsQueryKey = [
    'project',
    'customers',
    'software-accounts',
    tenantId,
    customerId,
  ];
  const catalogsQuery = useQuery({
    queryKey: ['project', 'tags', 'software-account-catalog', tenantId, 'all'],
    queryFn: () => loadSoftwareAccountCatalogs(tenantId, true),
  });

  const saveMutation = useMutation({
    mutationFn: ({
      account,
      editingAccountId,
    }: {
      account: CustomerSoftwareAccount;
      editingAccountId: string | undefined;
    }) => {
      const nextAccounts = editingAccountId
        ? accounts.map((currentAccount) =>
            currentAccount.id === editingAccountId ? account : currentAccount,
          )
        : [...accounts, account];

      return replaceCustomerSoftwareAccounts(customerId, nextAccounts);
    },
    onSuccess: (savedAccounts) => {
      queryClient.setQueryData(softwareAccountsQueryKey, savedAccounts);
      setAccountDialogOpen(false);
      setEditingAccount(null);
      toast.success(
        editingAccount
          ? 'Đã cập nhật tài khoản phần mềm.'
          : 'Đã thêm tài khoản phần mềm.',
      );
    },
    onError: (mutationError) => toast.error(getApiErrorMessage(mutationError)),
  });

  const deleteMutation = useMutation({
    mutationFn: (accountId: string) =>
      replaceCustomerSoftwareAccounts(
        customerId,
        accounts.filter((account) => account.id !== accountId),
      ),
    onSuccess: (savedAccounts) => {
      queryClient.setQueryData(softwareAccountsQueryKey, savedAccounts);
      setDeletingAccount(null);
      toast.success('Đã xóa tài khoản phần mềm.');
    },
    onError: (mutationError) => toast.error(getApiErrorMessage(mutationError)),
  });

  const isMutating = saveMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <Card>
        <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardHeading>
            <CardTitle>Tài khoản phần mềm</CardTitle>
          </CardHeading>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditingAccount(null);
              setAccountDialogOpen(true);
            }}
            disabled={isLoading || Boolean(error) || isMutating}
          >
            <Plus />
            Thêm tài khoản
          </Button>
        </CardHeader>
        <CardTable className="min-h-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1120px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Tên phần mềm</TableHead>
                  <TableHead className="min-w-[240px]">
                    Địa chỉ truy cập
                  </TableHead>
                  <TableHead className="min-w-[160px]">Tài khoản</TableHead>
                  <TableHead className="min-w-[140px]">Mật khẩu</TableHead>
                  <TableHead className="min-w-[160px]">
                    Loại tài khoản
                  </TableHead>
                  <TableHead className="min-w-[140px]">Ngày hết hạn</TableHead>
                  <TableHead className="w-24 text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    {Array.from({ length: 7 }, (_, index) => (
                      <TableCell key={index}>
                        <Skeleton className="h-5 w-full max-w-44" />
                      </TableCell>
                    ))}
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-28 text-center text-sm text-destructive"
                    >
                      {getApiErrorMessage(error)}
                    </TableCell>
                  </TableRow>
                ) : accounts.length > 0 ? (
                  accounts.map((account) => (
                    <TableRow key={account.id ?? account.softwareName}>
                      <TableCell className="font-medium text-foreground">
                        {account.softwareName}
                      </TableCell>
                      <TableCell>
                        {account.accessUrl ? (
                          <a
                            href={account.accessUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {account.accessUrl}
                          </a>
                        ) : null}
                      </TableCell>
                      <TableCell>{account.username}</TableCell>
                      <TableCell>
                        {account.hasPassword ? (
                          <span aria-label="Mật khẩu đã lưu">••••••••</span>
                        ) : null}
                      </TableCell>
                      <TableCell>{account.accountType}</TableCell>
                      <TableCell>{formatDate(account.expiresAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <DataGridActionButton
                            action="edit"
                            tooltip="Sửa"
                            type="button"
                            mode="icon"
                            size="sm"
                            aria-label={`Sửa tài khoản phần mềm ${account.softwareName}`}
                            onClick={() => {
                              setEditingAccount(account);
                              setAccountDialogOpen(true);
                            }}
                            disabled={isMutating}
                          >
                            <Pencil className="size-4" />
                          </DataGridActionButton>
                          <DataGridActionButton
                            action="delete"
                            tooltip="Xóa"
                            type="button"
                            mode="icon"
                            size="sm"
                            aria-label={`Xóa tài khoản phần mềm ${account.softwareName}`}
                            onClick={() => setDeletingAccount(account)}
                            disabled={isMutating}
                          >
                            <Trash2 className="size-4" />
                          </DataGridActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-28 text-center text-sm text-muted-foreground"
                    >
                      Chưa có tài khoản phần mềm
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardTable>
      </Card>
      <CustomerSoftwareAccountDialog
        key={
          editingAccount?.id ??
          (accountDialogOpen ? 'new-dialog-open' : 'new-dialog-closed')
        }
        open={accountDialogOpen}
        onOpenChange={(open) => {
          setAccountDialogOpen(open);
          if (!open) setEditingAccount(null);
        }}
        customerName={customerName}
        account={editingAccount}
        catalogs={catalogsQuery.data ?? ([] as SoftwareAccountCatalog[])}
        isSaving={saveMutation.isPending}
        onSubmit={(account) =>
          saveMutation.mutate({
            account,
            editingAccountId: editingAccount?.id,
          })
        }
      />
      <ConfirmDialog
        open={Boolean(deletingAccount)}
        onOpenChange={(open) => {
          if (!open) setDeletingAccount(null);
        }}
        title="Xóa tài khoản phần mềm?"
        description={`Bạn có chắc muốn xóa tài khoản "${deletingAccount?.softwareName ?? ''}"?`}
        confirmLabel="Xóa tài khoản"
        confirmVariant="destructive"
        onConfirm={() => {
          if (deletingAccount?.id) {
            deleteMutation.mutate(deletingAccount.id);
          }
        }}
      />
    </>
  );
}
