import { useCallback, useMemo, useState } from 'react';
import { custodianTypeFromSourceType } from '@/project/custodians/api/custodians.api';
import {
  useCustodianAccountOptionsQuery,
  useCustodiansQuery,
  useFakeEpsPartiesQuery,
  useSaveCustodianMutation,
} from '@/project/custodians/hooks/use-custodians';
import type { Custodian } from '@/project/custodians/model/custodian';
import { CUSTODIAN_PERMISSION_CODES } from '@/project/custodians/model/custodian-permissions';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Building2, Plus } from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridHeaderMenu } from '@/components/ui/data-grid-header-menu';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/inputs/search-input';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { CustodianFormValues as CustodianEditorValues } from '../../custodians/model/custodian-form-schema';
import {
  custodianDefaultValues,
  CustodianFormDialog,
  mapCustodianToFormValues,
  useCustodianForm,
} from '../forms/custodian-form.generated';
import {
  CUSTODIAN_COLUMN_PINNING,
  useCustodianColumns,
} from '../table/custodian.columns.generated';

const EMPTY_CUSTODIANS: Custodian[] = [];

export function CustodiansPage() {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView =
    hasPermission(CUSTODIAN_PERMISSION_CODES.view) ||
    hasPermission('materials:handover:view') ||
    hasPermission('materials:material:view');
  const canManage = hasPermission(CUSTODIAN_PERMISSION_CODES.manage);
  const query = useCustodiansQuery(true, !isPermissionsPending && canView);
  const accountsQuery = useCustodianAccountOptionsQuery(
    !isPermissionsPending && canManage,
  );
  const fakeEpsPartiesQuery = useFakeEpsPartiesQuery(
    !isPermissionsPending && canManage,
  );
  const saveMutation = useSaveCustodianMutation();
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCustodian, setEditingCustodian] = useState<Custodian | null>(
    null,
  );
  const createForm = useCustodianForm({
    defaultValues: custodianDefaultValues,
  });
  const editForm = useCustodianForm({ defaultValues: custodianDefaultValues });
  const custodians = useMemo(
    () =>
      (query.data ?? EMPTY_CUSTODIANS).filter(
        (party) => party.type !== 'warehouse' && party.type !== 'external',
      ),
    [query.data],
  );
  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase('vi');
    if (!normalized) return custodians;
    return custodians.filter((party) =>
      [party.code, party.name, party.representativeDisplayName ?? ''].some(
        (value) => value.toLocaleLowerCase('vi').includes(normalized),
      ),
    );
  }, [custodians, keyword]);
  const handleEditCustodian = useCallback(
    (custodian: Custodian) => {
      if (custodian.type === 'warehouse') return;
      setEditingCustodian(custodian);
      editForm.reset(mapCustodianToFormValues(custodian));
      setEditOpen(true);
    },
    [editForm],
  );
  const columns = useCustodianColumns({
    canManage,
    onEdit: handleEditCustodian,
  });
  const table = useReactTable({
    data: filtered,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { columnPinning: CUSTODIAN_COLUMN_PINNING },
  });
  const accountOptions = useMemo(
    () =>
      (accountsQuery.data ?? []).map((account) => ({
        value: account.id,
        label: account.username
          ? `${account.displayName} · ${account.username}`
          : account.displayName,
      })),
    [accountsQuery.data],
  );
  const sourceOptions = useMemo(() => {
    const sources = fakeEpsPartiesQuery.data ?? [];
    const selectedSource =
      editingCustodian?.sourceId && editingCustodian.sourceType
        ? {
            source_type: editingCustodian.sourceType,
            source_id: editingCustodian.sourceId,
            code: editingCustodian.code,
            name: editingCustodian.name,
          }
        : null;
    const records =
      selectedSource &&
      !sources.some(
        (source) =>
          source.source_id === selectedSource.source_id &&
          source.source_type === selectedSource.source_type,
      )
        ? [...sources, selectedSource]
        : sources;
    return records.map((source) => ({
      value: `${source.source_type}:${source.source_id}`,
      label: `${intl.formatMessage({ id: `project.handover.custodians.sourceType.${source.source_type}` })} · ${source.name} · ${source.code}`,
    }));
  }, [editingCustodian, fakeEpsPartiesQuery.data, intl]);

  const submit = (
    id: string | null,
    values: CustodianEditorValues,
    close: (open: boolean) => void,
  ) => {
    if (!canManage) return;
    const source = fakeEpsPartiesQuery.data?.find(
      (party) => `${party.source_type}:${party.source_id}` === values.sourceKey,
    );
    const sourceType = source?.source_type ?? editingCustodian?.sourceType;
    if (!sourceType) {
      toast.error(
        intl.formatMessage({
          id: 'project.handover.custodians.errors.selectEpsSource',
        }),
      );
      return;
    }
    saveMutation.mutate(
      {
        id,
        values: {
          sourceId: source?.source_id ?? editingCustodian?.sourceId ?? '',
          type: custodianTypeFromSourceType(sourceType),
          representativeUserId: values.representativeUserId || null,
        },
      },
      {
        onSuccess: () => {
          toast.success(
            intl.formatMessage({
              id: 'project.handover.custodians.toasts.saved',
            }),
          );
          close(false);
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({
          id: 'project.handover.custodians.page.title',
        })}
        icon={Building2}
        actions={
          canManage && (fakeEpsPartiesQuery.data?.length ?? 0) > 0 ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
            >
              <Plus />
              {intl.formatMessage({
                id: 'project.handover.custodians.actions.create',
              })}
            </Button>
          ) : null
        }
      />
      {accountsQuery.isError && canManage ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.handover.custodians.errors.accountsTitle',
          })}
          description={getApiErrorMessage(accountsQuery.error)}
          onRetry={() => void accountsQuery.refetch()}
        />
      ) : null}
      {fakeEpsPartiesQuery.isError && canManage ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.handover.custodians.errors.epsDirectoryTitle',
          })}
          description={getApiErrorMessage(fakeEpsPartiesQuery.error)}
          onRetry={() => void fakeEpsPartiesQuery.refetch()}
        />
      ) : null}
      <DataGrid
        table={table}
        recordCount={filtered.length}
        isLoading={isPermissionsPending || (canView && query.isPending)}
        isFetching={query.isFetching}
        emptyMessage={intl.formatMessage({
          id: keyword
            ? 'project.handover.custodians.empty.search'
            : 'project.handover.custodians.empty.list',
        })}
        tableLayout={{ dense: true }}
      >
        <Card className="min-h-[32rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel={intl.formatMessage({
              id: 'project.handover.labels.custodianCount',
            })}
            stats={
              <SearchInput
                aria-label="Tìm mã, tên hoặc người đại diện"
                value={keyword}
                onSearch={(value) => {
                  setKeyword(value);
                  table.setPageIndex(0);
                }}
                className="w-72"
              />
            }
            toolbar={<DataGridHeaderMenu table={table} />}
          />
          <CardTable className="min-h-0 flex-1">
            {!isPermissionsPending && !canView ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.handover.errors.noCustodianPermission',
                })}
                description={intl.formatMessage({
                  id: 'project.handover.errors.contactAdmin',
                })}
              />
            ) : query.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.handover.custodians.errors.loadTitle',
                })}
                description={getApiErrorMessage(query.error)}
                onRetry={() => void query.refetch()}
              />
            ) : (
              <ScrollArea className="h-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardTable>
          <CardFooter className="justify-between">
            {canView && !query.isError ? <DataGridPagination /> : null}
          </CardFooter>
        </Card>
      </DataGrid>
      <CustodianFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        form={createForm}
        onSubmit={(values) => submit(null, values, setCreateOpen)}
        isSaving={saveMutation.isPending}
        title={intl.formatMessage({
          id: 'project.handover.custodians.dialogs.createTitle',
        })}
        sourceKeyOptions={sourceOptions}
        representativeUserIdOptions={accountOptions}
      />
      <CustodianFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        form={editForm}
        onSubmit={(values) =>
          editingCustodian && submit(editingCustodian.id, values, setEditOpen)
        }
        isSaving={saveMutation.isPending}
        title={intl.formatMessage({
          id: 'project.handover.custodians.dialogs.editTitle',
        })}
        sourceKeyOptions={
          editingCustodian?.sourceId && editingCustodian.sourceType
            ? sourceOptions.filter(
                (source) =>
                  source.value ===
                  `${editingCustodian.sourceType}:${editingCustodian.sourceId}`,
              )
            : sourceOptions
        }
        representativeUserIdOptions={accountOptions}
      />
    </div>
  );
}
