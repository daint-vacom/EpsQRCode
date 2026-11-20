import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import type { Custodian } from '@/project/custodians/model/custodian';
import { useMaterialsByIdsQuery } from '@/project/materials/hooks/use-materials';
import { WarehouseSelect } from '@/project/warehouses/components/warehouse-select';
import { useWarehousesQuery } from '@/project/warehouses/hooks/use-warehouses';
import { format } from 'date-fns';
import { FilePlus2, Save } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { OptionSelect } from '@/components/ui/option-select';
import { Textarea } from '@/components/ui/textarea';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import {
  handoverDefaultValues,
  mapHandoverToFormValues,
  useHandoverForm,
} from '../forms/handover-form.generated';
import {
  useHandoverQuery,
  useSaveWarehouseHandoverMutation,
} from '../hooks/use-handovers';
import type { HandoverMode } from '../model/handover';
import { HANDOVER_PERMISSION_CODES } from '../model/handover-permissions';
import { HandoverItemsEditorTable } from '../table/handover-items-editor-table.generated';

const WAREHOUSE_MODES: readonly Exclude<HandoverMode, 'standard'>[] = [
  'warehouse_allocation',
  'warehouse_request',
];

function isWarehouseMode(
  value: string | null,
): value is Exclude<HandoverMode, 'standard'> {
  return WAREHOUSE_MODES.some((mode) => mode === value);
}

function represents(party: Custodian | undefined, userId: string | null) {
  return Boolean(
    userId &&
    party &&
    (party.accountUserId === userId ||
      party.accountUserIds.includes(userId) ||
      party.representativeUserId === userId),
  );
}

export function WarehouseHandoverEditorPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') ?? '';
  const requestedMode = searchParams.get('mode');
  const hasFixedMode = isWarehouseMode(requestedMode);
  const receiptIdFromUrl = searchParams.get('receiptId') ?? '';
  const warehouseIdFromUrl = searchParams.get('warehouseId') ?? '';
  const { userId, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canManage = hasPermission(HANDOVER_PERMISSION_CODES.manage);
  const documentQuery = useHandoverQuery(id, canManage);
  const custodiansQuery = useCustodiansQuery(false, canManage);
  const warehousesQuery = useWarehousesQuery(false, canManage);
  const saveMutation = useSaveWarehouseHandoverMutation();
  const document = documentQuery.data;
  const [mode, setMode] = useState<Exclude<HandoverMode, 'standard'>>(
    hasFixedMode ? requestedMode : 'warehouse_allocation',
  );
  const initialized = useRef(false);
  const loadedDocumentVersion = useRef('');
  const form = useHandoverForm({
    defaultValues: {
      ...handoverDefaultValues,
      plannedDate: format(new Date(), 'yyyy-MM-dd'),
    },
  });
  const parties = custodiansQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const receiptId = document?.receiptId ?? (receiptIdFromUrl || null);
  const allowedWarehouses = warehouses.filter(
    (warehouse) =>
      warehouse.isActive &&
      (mode === 'warehouse_request' ||
        warehouse.accountUserIds.includes(userId ?? '')),
  );
  const representedUnits = parties.filter(
    (party) =>
      party.isActive && party.type !== 'warehouse' && represents(party, userId),
  );
  const allowedRecipients = parties.filter(
    (party) =>
      party.isActive &&
      party.type !== 'warehouse' &&
      (mode === 'warehouse_request'
        ? represents(party, userId)
        : party.accountUserId !== null || party.representativeUserId !== null),
  );
  const selectedWarehouseId = form.watch('senderPartyId');
  const selectedItemIds = [
    ...new Set(
      (form.watch('items') ?? [])
        .map((item) => item.materialId)
        .filter(Boolean),
    ),
  ];
  const selectedMaterialsQuery = useMaterialsByIdsQuery(
    selectedItemIds,
    canManage,
  );
  const selectedMaterials = selectedMaterialsQuery.flatMap((item) =>
    item.data ? [item.data] : [],
  );
  const materialFilters = useMemo(
    () => ({
      ownerPartyId: selectedWarehouseId || undefined,
      ownerKind: 'warehouse' as const,
      status: 'available' as const,
      isActive: true,
      ...(receiptId ? { receiptId } : {}),
    }),
    [receiptId, selectedWarehouseId],
  );
  const isLoading =
    isPermissionsPending ||
    (documentQuery.isPending && Boolean(id)) ||
    custodiansQuery.isPending ||
    warehousesQuery.isPending;
  const dataError = documentQuery.isError
    ? documentQuery.error
    : (custodiansQuery.error ?? warehousesQuery.error);
  const pageTitle =
    document?.code ?? intl.formatMessage({ id: 'receipts.handover.title' });
  const navigateBack = useCallback(
    () =>
      navigate(
        receiptId
          ? ROUTES.PROJECT.RECEIPT_DETAIL.replace(':id', receiptId)
          : ROUTES.PROJECT.HANDOVERS,
      ),
    [navigate, receiptId],
  );

  useEffect(() => {
    if (document) {
      const documentVersion = `${document.id}:${document.version}`;
      if (loadedDocumentVersion.current === documentVersion) return;
      form.reset(mapHandoverToFormValues(document));
      if (isWarehouseMode(document.mode)) setMode(document.mode);
      loadedDocumentVersion.current = documentVersion;
      initialized.current = true;
      return;
    }
    if (id || initialized.current || isLoading) return;
    const representedUnitId =
      representedUnits.length === 1 ? representedUnits[0].id : '';
    form.reset({
      ...handoverDefaultValues,
      plannedDate: format(new Date(), 'yyyy-MM-dd'),
      senderPartyId: warehouseIdFromUrl,
      recipientPartyId: mode === 'warehouse_request' ? representedUnitId : '',
    });
    initialized.current = true;
  }, [
    document,
    form,
    id,
    isLoading,
    mode,
    representedUnits,
    warehouseIdFromUrl,
  ]);

  const onSubmit = form.handleSubmit((values) => {
    if (!canManage || !selectedWarehouseId || !values.recipientPartyId) return;
    saveMutation.mutate(
      {
        id: id || null,
        values: {
          mode,
          warehouseId: selectedWarehouseId,
          recipientPartyId: values.recipientPartyId,
          receiptId,
          plannedDate: values.plannedDate,
          note: values.note,
          items: values.items,
          ...(document ? { expectedVersion: document.version } : {}),
        },
      },
      {
        onSuccess: (savedId) => {
          toast.success(
            intl.formatMessage({ id: 'project.handover.toasts.saved' }),
          );
          navigate(ROUTES.PROJECT.HANDOVER_DETAIL.replace(':id', savedId));
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  });

  const header = useMemo(
    () => ({
      title: pageTitle,
      icon: FilePlus2,
      showBackButton: true,
      backLabel: intl.formatMessage({ id: 'project.handover.actions.back' }),
      onBack: navigateBack,
      actions:
        canManage && (!document || document.status === 'draft') ? (
          <Button
            type="submit"
            form="warehouse-handover-form"
            variant="primary"
            size="md"
            loading={saveMutation.isPending}
            loadingText={intl.formatMessage({
              id: 'project.handover.labels.saving',
            })}
          >
            <Save className="size-4" />
            {intl.formatMessage({ id: 'project.handover.actions.saveDraft' })}
          </Button>
        ) : null,
    }),
    [
      canManage,
      document,
      intl,
      navigateBack,
      pageTitle,
      saveMutation.isPending,
    ],
  );
  useDetailEntryLayoutHeader(header);

  if (isPermissionsPending)
    return (
      <div className="h-full min-h-0 p-4">
        <div className="h-full animate-pulse rounded-xl bg-muted" />
      </div>
    );
  if (!canManage)
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({
            id: 'project.handover.errors.noManagePermission',
          })}
          description={intl.formatMessage({
            id: 'project.handover.errors.noManagePermission',
          })}
        />
      </div>
    );
  if (isLoading)
    return (
      <div className="h-full min-h-0 p-4">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  if (dataError)
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({ id: 'receipts.handover.loadError' })}
          description={getApiErrorMessage(dataError)}
          onRetry={() => {
            void documentQuery.refetch();
            void custodiansQuery.refetch();
            void warehousesQuery.refetch();
          }}
        />
      </div>
    );
  if (id && !document)
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({
            id: 'project.handover.errors.loadDetailTitle',
          })}
          description={intl.formatMessage({
            id: 'project.handover.errors.loadDetailTitle',
          })}
          onRetry={() => void documentQuery.refetch()}
        />
      </div>
    );
  if (document && document.status !== 'draft')
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({
            id: 'project.handover.errors.draftOnly',
          })}
          description={intl.formatMessage({
            id: 'project.handover.errors.draftOnly',
          })}
        />
      </div>
    );
  if (
    mode === 'warehouse_allocation' &&
    (!allowedWarehouses.length ||
      (selectedWarehouseId &&
        !allowedWarehouses.some(
          (warehouse) => warehouse.id === selectedWarehouseId,
        )))
  )
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({
            id: 'receipts.handover.noRepresentedWarehouse',
          })}
          description={intl.formatMessage({
            id: 'receipts.handover.noRepresentedWarehouse',
          })}
        />
      </div>
    );
  if (
    mode === 'warehouse_request' &&
    (!representedUnits.length ||
      (document &&
        !representedUnits.some(
          (party) => party.id === document.recipientParty.id,
        )))
  )
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({
            id: 'receipts.handover.noRepresentedUnit',
          })}
          description={intl.formatMessage({
            id: 'receipts.handover.noRepresentedUnit',
          })}
        />
      </div>
    );

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 lg:p-5">
      <Form {...form}>
        <form
          id="warehouse-handover-form"
          onSubmit={onSubmit}
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle>
                {intl.formatMessage({
                  id: 'project.handover.sections.parties',
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasFixedMode && !document ? (
                <FormItem layout="horizontal" labelWidth="md">
                  <FormLabel>
                    {intl.formatMessage({ id: 'receipts.handover.mode' })}
                    <span className="ml-1 text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <OptionSelect
                      value={mode}
                      onChange={(value) => {
                        const nextMode = value as Exclude<
                          HandoverMode,
                          'standard'
                        >;
                        setMode(nextMode);
                        form.setValue('senderPartyId', '', {
                          shouldDirty: true,
                        });
                        form.setValue('recipientPartyId', '', {
                          shouldDirty: true,
                        });
                        form.setValue('items', [], { shouldDirty: true });
                      }}
                      options={WAREHOUSE_MODES.filter((item) =>
                        item === 'warehouse_request'
                          ? representedUnits.length > 0
                          : warehouses.some((warehouse) =>
                              warehouse.accountUserIds.includes(userId ?? ''),
                            ),
                      ).map((item) => ({
                        value: item,
                        label: intl.formatMessage({
                          id: `receipts.handover.mode.${item}`,
                        }),
                      }))}
                      searchable={false}
                    />
                  </FormControl>
                </FormItem>
              ) : null}
              <FormField
                control={form.control}
                name="senderPartyId"
                render={({ field }) => (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id: 'project.handover.fields.sender',
                      })}
                      <span className="ml-1 text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <WarehouseSelect
                        sourceMode="options"
                        warehouses={allowedWarehouses}
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          field.onBlur();
                          form.setValue('items', [], { shouldDirty: true });
                        }}
                        disabled={
                          Boolean(receiptId || document) ||
                          !allowedWarehouses.length
                        }
                        placeholder={intl.formatMessage({
                          id: 'warehouses.select.placeholder',
                        })}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="recipientPartyId"
                render={({ field }) => (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id: 'receipts.handover.recipient',
                      })}
                      <span className="ml-1 text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <OptionSelect
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          field.onBlur();
                        }}
                        options={allowedRecipients.map((party) => ({
                          value: party.id,
                          label: `${party.name} · ${party.code}`,
                        }))}
                        placeholder={intl.formatMessage({
                          id: 'receipts.handover.noRecipient',
                        })}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="plannedDate"
                render={({ field }) => (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id: 'project.handover.fields.plannedDate',
                      })}
                      <span className="ml-1 text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <DatePickerInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        valueMode="iso-date"
                        variant="md"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id: 'project.handover.fields.note',
                      })}
                    </FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} variant="md" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          <Card className="min-h-[28rem] min-w-0 overflow-hidden">
            <HandoverItemsEditorTable
              form={form}
              materials={selectedMaterials}
              materialFilters={materialFilters}
              initialMaterialSearch=""
              allowReservedByHandoverId={id || undefined}
              toolbarContent={
                receiptId ? (
                  <span className="text-xs text-muted-foreground">
                    {intl.formatMessage({ id: 'receipts.handover.stockTitle' })}
                  </span>
                ) : null
              }
            />
          </Card>
        </form>
      </Form>
    </div>
  );
}
