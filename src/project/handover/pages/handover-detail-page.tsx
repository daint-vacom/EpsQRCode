import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import { loadFileStorageReference } from '@/project/files/api/file-manager.api';
import { MATERIAL_RECEIPT_PERMISSION_CODES } from '@/project/receipts/model/material-receipt';
import { Boxes, CircleCheck, Pencil, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { createSignedStorageUrl } from '@/lib/storage';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { OptionSelect } from '@/components/ui/option-select';
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper';
import { Textarea } from '@/components/ui/textarea';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { HandoverDetailLayout } from '../detail/handover-detail-layout.generated';
import {
  useCompleteHandoverOfflineMutation,
  useHandoverActionMutation,
  useHandoverHistoryQuery,
  useHandoverQuery,
  useWarehouseHandoverActionMutation,
} from '../hooks/use-handovers';
import type {
  HandoverAction,
  HandoverDocument,
  HandoverItemInput,
} from '../model/handover';
import { HANDOVER_PERMISSION_CODES } from '../model/handover-permissions';

type ReasonAction = 'reject' | 'cancel';
type PageAction = HandoverAction | 'approve';
const EMPTY_ITEMS: HandoverDocument['items'] = [];

export function HandoverDetailPage({
  actionsOnly = false,
  approvalActionsTargetRef,
}: {
  actionsOnly?: boolean;
  approvalActionsTargetRef?: RefObject<HTMLDivElement | null>;
}) {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const { userId, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(HANDOVER_PERMISSION_CODES.view);
  const canManage = hasPermission(HANDOVER_PERMISSION_CODES.manage);
  const canViewReceipt =
    hasPermission(MATERIAL_RECEIPT_PERMISSION_CODES.view) ||
    hasPermission(MATERIAL_RECEIPT_PERMISSION_CODES.manage);
  const canViewDocument = canView || canManage || canViewReceipt;
  const query = useHandoverQuery(id, isPermissionsPending || canViewDocument);
  const historyQuery = useHandoverHistoryQuery(
    id,
    isPermissionsPending || canViewDocument,
  );
  const custodiansQuery = useCustodiansQuery(
    true,
    isPermissionsPending || canViewDocument,
  );
  const mutation = useHandoverActionMutation();
  const offlineMutation = useCompleteHandoverOfflineMutation();
  const warehouseMutation = useWarehouseHandoverActionMutation();
  const { mutateAsync: mutateHandoverAction } = mutation;
  const isActionPending =
    mutation.isPending ||
    warehouseMutation.isPending ||
    offlineMutation.isPending;
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [offlineConfirmOpen, setOfflineConfirmOpen] = useState(false);
  const [approvalActionsTarget, setApprovalActionsTarget] =
    useState<HTMLDivElement | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [receiverConditions, setReceiverConditions] = useState<
    HandoverItemInput[]
  >([]);
  const [receiverOutcomes, setReceiverOutcomes] = useState<
    Record<string, boolean>
  >({});
  const document = query.data;
  const custodianList = custodiansQuery.data ?? [];
  const senderParty = custodianList.find(
    (party) => party.id === document?.senderParty.id,
  );
  const recipientParty = custodianList.find(
    (party) => party.id === document?.recipientParty.id,
  );
  const isSender = Boolean(
    userId && (senderParty?.canRepresent || document?.senderCanRepresent),
  );
  const isReceiver = Boolean(
    userId &&
    document?.recipientParty.type !== 'other' &&
    !document?.recipientParty.isHandoverCustom &&
    (recipientParty?.canRepresent || document?.recipientCanRepresent),
  );
  const items = document?.items ?? EMPTY_ITEMS;
  const isWarehouseHandover = Boolean(document && document.mode !== 'standard');
  const hasOtherParty = Boolean(
    document &&
    (document.senderParty.type === 'other' ||
      document.senderParty.isHandoverCustom ||
      document.recipientParty.type === 'other' ||
      document.recipientParty.isHandoverCustom),
  );
  const isHandoverCreator = Boolean(userId && document?.createdBy === userId);
  const senderSigned = Boolean(
    document &&
    (document.status === 'pending' ||
      document.status === 'completed' ||
      document.status === 'rejected' ||
      (document.status === 'awaiting_warehouse_approval' &&
        document.mode !== 'warehouse_request')),
  );
  const recipientSigned = Boolean(
    document &&
    ((document.status === 'completed' &&
      (document.mode !== 'standard' || document.recipientHasQrAccount)) ||
      (document.mode === 'warehouse_request' &&
        ['awaiting_warehouse_approval', 'pending', 'rejected'].includes(
          document.status,
        ))),
  );
  const canEditOrSend = Boolean(
    canManage &&
    document?.status === 'draft' &&
    (document.mode === 'warehouse_request' ? isReceiver : isSender),
  );
  const canCancel = Boolean(
    canManage &&
    document &&
    (isWarehouseHandover
      ? (document.mode === 'warehouse_request' &&
          document.status === 'draft' &&
          isReceiver) ||
        (document.mode === 'warehouse_allocation' &&
          document.status === 'draft' &&
          isSender) ||
        (document.status === 'pending' && isSender)
      : isSender && ['draft', 'pending'].includes(document.status)),
  );
  const canConfirm = Boolean(
    canManage &&
    document?.status === 'pending' &&
    (hasOtherParty
      ? isHandoverCreator && (isSender || isReceiver)
      : isReceiver),
  );
  const canReject = Boolean(
    canManage &&
    document?.status === 'pending' &&
    (hasOtherParty
      ? isHandoverCreator && (isSender || isReceiver)
      : isReceiver),
  );
  const canCompleteOffline = Boolean(
    canManage &&
    isSender &&
    document?.mode === 'standard' &&
    document.status === 'pending' &&
    document.recipientHasQrAccount === false &&
    !hasOtherParty &&
    !isReceiver,
  );
  const canCreateReverse = Boolean(
    canManage &&
    isSender &&
    document?.mode === 'standard' &&
    document.status === 'completed' &&
    (document.recipientParty.type === 'other' ||
      document.recipientParty.isHandoverCustom) &&
    ['transfer', 'loan'].includes(document.type),
  );

  const runAction = useCallback(
    async (action: PageAction, note?: string) => {
      if (!document) return;
      try {
        if (document.mode === 'standard') {
          if (action === 'approve') return;
          await mutateHandoverAction({
            id: document.id,
            action,
            expectedVersion: document.version,
            note,
            ...(action === 'confirm'
              ? { itemConditions: receiverConditions }
              : {}),
          });
        } else {
          await warehouseMutation.mutateAsync({
            id: document.id,
            action,
            expectedVersion: document.version,
            note,
            ...(action === 'confirm'
              ? {
                  itemResults: receiverConditions.map((entry) => ({
                    ...entry,
                    outcome: receiverOutcomes[entry.materialId]
                      ? ('received' as const)
                      : ('not_received' as const),
                  })),
                }
              : {}),
          });
        }
        const key = `project.handover.toasts.${action === 'send' ? 'sent' : action === 'confirm' ? 'confirmed' : action === 'approve' ? 'warehouseApproved' : action === 'reject' ? 'rejected' : 'cancelled'}`;
        toast.success(intl.formatMessage({ id: key }));
        setReasonAction(null);
        setReason('');
        setConfirmOpen(false);
      } catch (error) {
        toast.error(getApiErrorMessage(error));
      }
    },
    [
      document,
      intl,
      mutateHandoverAction,
      receiverConditions,
      receiverOutcomes,
      warehouseMutation,
    ],
  );

  const completeOffline = useCallback(async () => {
    if (!document) return;
    try {
      await offlineMutation.mutateAsync({
        id: document.id,
        expectedVersion: document.version,
      });
      toast.success(
        intl.formatMessage({
          id: 'project.handover.toasts.confirmedOffline',
        }),
      );
      setOfflineConfirmOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }, [document, intl, offlineMutation]);

  const openAttachment = async (fileId: string) => {
    const targetWindow = window.open('', '_blank');
    if (!targetWindow) {
      toast.error(
        intl.formatMessage({ id: 'project.handover.errors.popupBlocked' }),
      );
      return;
    }
    targetWindow.opener = null;
    try {
      const reference = await loadFileStorageReference(fileId);
      targetWindow.location.href = await createSignedStorageUrl(
        reference.storageBucket,
        reference.storagePath,
      );
    } catch (error) {
      targetWindow.close();
      toast.error(getApiErrorMessage(error));
    }
  };

  const headerActions = useMemo(
    () =>
      document ? (
        <div className="flex flex-wrap gap-2">
          {canEditOrSend ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() =>
                  navigate(ROUTES.PROJECT.HANDOVER_EDIT.replace(':id', id))
                }
              >
                <Pencil className="size-4" />
                {intl.formatMessage({ id: 'project.handover.actions.edit' })}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={isActionPending}
                onClick={() => void runAction('send')}
              >
                <CircleCheck className="size-4" />
                {intl.formatMessage({ id: 'project.handover.actions.send' })}
              </Button>
            </>
          ) : null}
          {document.mode === 'warehouse_request' &&
          document.status === 'awaiting_warehouse_approval' &&
          canManage &&
          isSender ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  setReasonAction('reject');
                  setReason('');
                }}
              >
                {intl.formatMessage({ id: 'project.handover.actions.reject' })}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={isActionPending}
                onClick={() => void runAction('approve')}
              >
                {intl.formatMessage({
                  id: 'project.handover.actions.approveWarehouse',
                })}
              </Button>
            </>
          ) : null}
          {!actionsOnly && canReject ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                setReasonAction('reject');
                setReason('');
              }}
            >
              {intl.formatMessage({ id: 'project.handover.actions.reject' })}
            </Button>
          ) : null}
          {!actionsOnly && canConfirm ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => {
                  setReceiverConditions(
                    items.map((item) => ({
                      materialId: item.materialId,
                      condition: item.condition,
                      note: item.note ?? '',
                    })),
                  );
                  setReceiverOutcomes(
                    Object.fromEntries(
                      items.map((item) => [
                        item.materialId,
                        item.receiverOutcome !== 'not_received',
                      ]),
                    ),
                  );
                  setConfirmOpen(true);
                }}
              >
                <CircleCheck className="size-4" />
                {intl.formatMessage({ id: 'project.handover.actions.confirm' })}
              </Button>
            </>
          ) : null}
          {canCompleteOffline ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={isActionPending}
              onClick={() => setOfflineConfirmOpen(true)}
            >
              <CircleCheck className="size-4" />
              {intl.formatMessage({
                id: 'project.handover.actions.completeOffline',
              })}
            </Button>
          ) : null}
          {canCreateReverse ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() =>
                navigate(
                  `${ROUTES.PROJECT.HANDOVER_CREATE}?reverseFrom=${document.id}`,
                )
              }
            >
              <Boxes className="size-4" />
              {intl.formatMessage({
                id:
                  document.type === 'loan'
                    ? 'project.handover.actions.createReverseReturn'
                    : 'project.handover.actions.createReverseTransfer',
              })}
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              variant="destructive"
              size="md"
              onClick={() => {
                setReasonAction('cancel');
                setReason('');
              }}
            >
              <X className="size-4" />
              {intl.formatMessage({ id: 'project.handover.actions.cancel' })}
            </Button>
          ) : null}
        </div>
      ) : null,
    [
      canCancel,
      canEditOrSend,
      actionsOnly,
      canConfirm,
      canReject,
      canManage,
      document,
      id,
      intl,
      items,
      isSender,
      isActionPending,
      canCompleteOffline,
      canCreateReverse,
      navigate,
      runAction,
    ],
  );
  const approvalActions = useMemo(
    () =>
      canReject || canConfirm ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          {canReject ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                setReasonAction('reject');
                setReason('');
              }}
            >
              {intl.formatMessage({ id: 'project.handover.actions.reject' })}
            </Button>
          ) : null}
          {canConfirm ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => {
                setReceiverConditions(
                  items.map((item) => ({
                    materialId: item.materialId,
                    condition: item.condition,
                    note: item.note ?? '',
                  })),
                );
                setReceiverOutcomes(
                  Object.fromEntries(
                    items.map((item) => [
                      item.materialId,
                      item.receiverOutcome !== 'not_received',
                    ]),
                  ),
                );
                setConfirmOpen(true);
              }}
            >
              <CircleCheck className="size-4" />
              {intl.formatMessage({ id: 'project.handover.actions.confirm' })}
            </Button>
          ) : null}
        </div>
      ) : null,
    [canConfirm, canReject, intl, items],
  );
  useEffect(() => {
    if (actionsOnly && approvalActionsTargetRef) {
      setApprovalActionsTarget(approvalActionsTargetRef.current);
    }
  }, [actionsOnly, approvalActionsTargetRef]);
  const header = useMemo(
    () => ({
      title: document?.code ?? 'Chi tiết phiếu bàn giao',
      icon: Boxes,
      showBackButton: true,
      backLabel: intl.formatMessage({ id: 'project.handover.actions.back' }),
      onBack: () => navigate(ROUTES.PROJECT.HANDOVERS),
      actions: headerActions,
    }),
    [document?.code, headerActions, intl, navigate],
  );
  useDetailEntryLayoutHeader(
    header,
    !actionsOnly || document?.status !== 'draft',
  );

  if (isPermissionsPending)
    return <div className="h-full animate-pulse bg-muted" />;
  if (!canViewDocument)
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({
            id: 'project.handover.errors.noViewPermission',
          })}
          description={intl.formatMessage({
            id: 'project.handover.errors.contactAdmin',
          })}
        />
      </div>
    );
  if (query.isPending)
    return (
      <div className="h-full p-4">
        <div className="h-full animate-pulse rounded-xl bg-muted" />
      </div>
    );
  if (query.isError || !document)
    return (
      <div className="p-4">
        <ErrorState
          title={intl.formatMessage({
            id: 'project.handover.errors.loadDetailTitle',
          })}
          description={getApiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      </div>
    );

  const typeLabel = intl.formatMessage({
    id: `project.handover.type.${document.type}`,
  });
  const statusLabel = intl.formatMessage({
    id: `project.handover.status.${document.status}`,
  });
  const profile = (
    <Card>
      <CardContent className="flex flex-col items-center p-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Boxes className="size-7" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">{document.code}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{typeLabel}</p>
        <div className="mt-5 w-full border-t border-border pt-4 text-left text-sm">
          <p className="text-muted-foreground">Bên giao</p>
          <p className="font-medium">{document.senderParty.name}</p>
          <p className="mt-3 text-muted-foreground">Bên nhận</p>
          <p className="font-medium">{document.recipientParty.name}</p>
          {document.recipientHasQrAccount === false ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {intl.formatMessage({
                id: 'project.handover.labels.receiverWithoutQrAccount',
              })}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
  const information = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Thông tin phiếu</CardTitle>
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
            {statusLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Ngày dự kiến" value={document.plannedDate ?? ''} />
        <Info label="Hạn trả" value={document.dueDate ?? ''} />
        <Info
          label="Đại diện bên giao"
          value={document.senderRepresentative?.displayName ?? ''}
        />
        <Info
          label="Đại diện bên nhận"
          value={document.recipientRepresentative?.displayName ?? ''}
        />
        <Info
          label="Ngày lập"
          value={new Date(document.createdAt).toLocaleString('vi-VN')}
        />
        <Info label="Ghi chú" value={document.note ?? ''} />
      </CardContent>
    </Card>
  );
  const itemsContent = (
    <Card>
      <CardHeader>
        <CardTitle>
          {intl.formatMessage({ id: 'project.handover.tabs.items' })} ·{' '}
          {items.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2">Vật tư</th>
              <th className="py-2">Mẫu</th>
              <th className="py-2">Số sê-ri</th>
              <th className="py-2">Lúc giao</th>
              <th className="py-2">Khi nhận</th>
              <th className="py-2">
                {intl.formatMessage({ id: 'project.handover.fields.note' })}
              </th>
              {isWarehouseHandover ? (
                <th className="py-2">
                  {intl.formatMessage({
                    id: 'project.handover.fields.receiptOutcome',
                  })}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="py-3">
                  <span className="font-medium">{item.materialCode}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.materialName}
                  </span>
                </td>
                <td className="py-3">
                  {item.modelCode} · {item.modelName}
                </td>
                <td className="py-3">{item.serialNumber ?? ''}</td>
                <td className="py-3">
                  {intl.formatMessage({
                    id: `project.handover.condition.${item.senderCondition}`,
                  })}
                </td>
                <td className="py-3">
                  {intl.formatMessage({
                    id: `project.handover.condition.${item.condition}`,
                  })}
                </td>
                <td className="py-3">{item.note ?? ''}</td>
                {isWarehouseHandover ? (
                  <td className="py-3">
                    {intl.formatMessage({
                      id: `project.handover.receiptOutcome.${item.receiverOutcome}`,
                    })}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {intl.formatMessage({ id: 'project.handover.empty.items' })}
          </p>
        ) : null}
        {document.attachments.length ? (
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium">
              {intl.formatMessage({
                id: 'project.handover.fields.attachments',
              })}
            </p>
            <div className="space-y-1">
              {document.attachments.map((file) => (
                <div
                  key={file.fileId}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {file.fileName}{' '}
                    <span className="text-muted-foreground">
                      ({Math.ceil(file.sizeBytes / 1024)} KB)
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void openAttachment(file.fileId)}
                  >
                    {intl.formatMessage({
                      id: 'project.handover.actions.openAttachment',
                    })}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
  const historyContent = (
    <Card>
      <CardHeader>
        <CardTitle>
          {intl.formatMessage({ id: 'project.handover.tabs.history' })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {historyQuery.isError ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.handover.errors.historyTitle',
            })}
            description={getApiErrorMessage(historyQuery.error)}
            onRetry={() => void historyQuery.refetch()}
          />
        ) : historyQuery.isPending ? (
          <div className="h-20 animate-pulse rounded bg-muted" />
        ) : (
          <>
            <ol className="space-y-4">
              {(historyQuery.data ?? []).map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {intl.formatMessage({
                        id: `project.handover.events.${entry.action}`,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString('vi-VN')}
                      {entry.actorDisplayName
                        ? ` · ${entry.actorDisplayName}`
                        : ''}
                    </p>
                    {entry.note ? (
                      <p className="mt-1 text-sm">{entry.note}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
            {!historyQuery.data?.length ? (
              <p className="text-sm text-muted-foreground">
                {intl.formatMessage({ id: 'project.handover.empty.history' })}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      <div
        className={
          actionsOnly ? 'hidden' : 'h-full min-h-0 overflow-y-auto p-4 lg:p-5'
        }
      >
        <Stepper
          value={activeStep}
          onValueChange={(step) => setActiveStep(step === 2 ? 2 : 1)}
          className="flex min-h-full flex-col gap-4"
        >
          <StepperNav className="shrink-0 justify-center py-4">
            <StepperItem step={1} fill={false}>
              <StepperTrigger>
                <StepperIndicator className="data-[state=inactive]:bg-border data-[state=active]:ring-2 data-[state=active]:ring-primary data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background">
                  1
                </StepperIndicator>
                <StepperTitle>
                  {intl.formatMessage({ id: 'project.handover.steps.items' })}
                </StepperTitle>
              </StepperTrigger>
              <StepperSeparator
                className={`mx-4 my-0 h-0 w-12 flex-none border-t border-dashed ${activeStep === 2 ? 'border-primary' : 'border-border'} bg-transparent`}
              />
            </StepperItem>
            <StepperItem step={2} fill={false}>
              <StepperTrigger>
                <StepperIndicator className="data-[state=inactive]:bg-border data-[state=active]:ring-2 data-[state=active]:ring-primary data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background">
                  2
                </StepperIndicator>
                <StepperTitle>
                  {intl.formatMessage({
                    id: 'project.handover.steps.confirmation',
                  })}
                </StepperTitle>
              </StepperTrigger>
            </StepperItem>
          </StepperNav>
          <StepperContent value={1} className="flex min-h-0 flex-1 flex-col">
            <HandoverDetailLayout
              profile={profile}
              information={information}
              itemsContent={itemsContent}
              historyContent={historyContent}
            />
          </StepperContent>
          <StepperContent value={2} className="flex min-h-0 flex-1 flex-col">
            <Card className="mx-auto w-full max-w-5xl">
              <CardHeader>
                <CardTitle>
                  {intl.formatMessage({
                    id: 'project.handover.steps.confirmation',
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  {intl.formatMessage({
                    id: 'project.handover.steps.confirmationDescription',
                  })}
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {(
                    [
                      {
                        side: 'sender',
                        party: document.senderParty,
                        representative: document.senderRepresentative,
                      },
                      {
                        side: 'recipient',
                        party: document.recipientParty,
                        representative: document.recipientRepresentative,
                      },
                    ] as const
                  ).map(({ side, party, representative }) => (
                    <div
                      key={side}
                      className="rounded-lg border border-border p-4"
                    >
                      <p className="text-sm font-medium">
                        {intl.formatMessage({
                          id: `project.handover.fields.${side}`,
                        })}
                      </p>
                      <p className="mt-2 text-sm">{party.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {intl.formatMessage({
                          id: 'project.handover.fields.representative',
                        })}
                        : {representative?.displayName ?? '—'}
                      </p>
                      <p className="mt-4 border-t border-dashed border-border pt-3 text-sm">
                        {intl.formatMessage({
                          id: (
                            side === 'sender' ? senderSigned : recipientSigned
                          )
                            ? 'project.handover.table.signed'
                            : 'project.handover.table.pending',
                        })}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">
                    {intl.formatMessage(
                      { id: 'project.handover.steps.materialCount' },
                      { count: items.length },
                    )}
                  </p>
                  {canConfirm ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() => setConfirmOpen(true)}
                    >
                      {intl.formatMessage({
                        id: 'project.handover.actions.confirm',
                      })}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </StepperContent>
        </Stepper>
        <Dialog
          open={reasonAction !== null}
          onOpenChange={(open) =>
            !open && !isActionPending && setReasonAction(null)
          }
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {intl.formatMessage({
                  id:
                    reasonAction === 'reject'
                      ? 'project.handover.dialogs.rejectTitle'
                      : 'project.handover.dialogs.cancelTitle',
                })}
              </DialogTitle>
            </DialogHeader>
            <Textarea
              aria-label={intl.formatMessage({
                id: 'project.handover.fields.reason',
              })}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReasonAction(null)}
              >
                Đóng
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={isActionPending}
                loadingText={intl.formatMessage({
                  id: 'project.handover.labels.processing',
                })}
                disabled={!reason.trim()}
                onClick={() =>
                  reasonAction && void runAction(reasonAction, reason.trim())
                }
              >
                {reasonAction === 'reject'
                  ? intl.formatMessage({
                      id: 'project.handover.actions.reject',
                    })
                  : intl.formatMessage({
                      id: 'project.handover.actions.cancel',
                    })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={confirmOpen}
          onOpenChange={(open) =>
            !open && !isActionPending && setConfirmOpen(false)
          }
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {intl.formatMessage({
                  id: 'project.handover.dialogs.confirmTitle',
                })}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Xác nhận tình trạng của từng vật tư trước khi hoàn tất phiếu{' '}
              {document.code}.
            </p>
            <div className="max-h-[55vh] space-y-3 overflow-y-auto">
              {receiverConditions.map((condition, index) => {
                const item = items.find(
                  (row) => row.materialId === condition.materialId,
                );
                return (
                  <div
                    key={condition.materialId}
                    className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)] sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {item?.materialCode} · {item?.materialName}
                      </p>
                      {isWarehouseHandover ? (
                        <label className="mt-2 flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={
                              receiverOutcomes[condition.materialId] ?? true
                            }
                            onCheckedChange={(checked) =>
                              setReceiverOutcomes((current) => ({
                                ...current,
                                [condition.materialId]: checked === true,
                              }))
                            }
                          />
                          {intl.formatMessage({
                            id: 'project.handover.fields.itemReceived',
                          })}
                        </label>
                      ) : null}
                    </div>
                    <OptionSelect
                      disabled={
                        isWarehouseHandover &&
                        !receiverOutcomes[condition.materialId]
                      }
                      value={condition.condition}
                      onChange={(value) =>
                        setReceiverConditions((current) =>
                          current.map((entry) =>
                            entry.materialId === condition.materialId
                              ? {
                                  ...entry,
                                  condition:
                                    value as HandoverItemInput['condition'],
                                }
                              : entry,
                          ),
                        )
                      }
                      options={[
                        { value: 'good', label: 'Tốt' },
                        { value: 'damaged', label: 'Hỏng' },
                      ]}
                      searchable={false}
                    />
                    <Textarea
                      disabled={
                        isWarehouseHandover &&
                        !receiverOutcomes[condition.materialId]
                      }
                      rows={1}
                      aria-label={`${intl.formatMessage({ id: 'project.handover.fields.note' })} ${index + 1}`}
                      value={condition.note}
                      onChange={(event) =>
                        setReceiverConditions((current) =>
                          current.map((entry) =>
                            entry.materialId === condition.materialId
                              ? { ...entry, note: event.target.value }
                              : entry,
                          ),
                        )
                      }
                    />
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmOpen(false)}
              >
                Đóng
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={isActionPending}
                loadingText={intl.formatMessage({
                  id: 'project.handover.labels.confirming',
                })}
                onClick={() => void runAction('confirm')}
              >
                {intl.formatMessage({ id: 'project.handover.actions.confirm' })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ConfirmDialog
          open={offlineConfirmOpen}
          onOpenChange={setOfflineConfirmOpen}
          title={intl.formatMessage({
            id: 'project.handover.dialogs.completeOfflineTitle',
          })}
          description={intl.formatMessage(
            { id: 'project.handover.dialogs.completeOfflineDescription' },
            { code: document.code },
          )}
          confirmLabel={intl.formatMessage({
            id: 'project.handover.actions.completeOffline',
          })}
          isConfirming={offlineMutation.isPending}
          onConfirm={() => void completeOffline()}
        />
      </div>
      {actionsOnly && approvalActionsTarget
        ? createPortal(approvalActions, approvalActionsTarget)
        : null}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}
