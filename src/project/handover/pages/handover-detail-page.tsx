import { useCallback, useMemo, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import { loadFileStorageReference } from '@/project/files/api/file-manager.api';
import { Boxes, CircleCheck, Pencil, X } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { createSignedStorageUrl } from '@/lib/storage';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { OptionSelect } from '@/components/ui/option-select';
import { Textarea } from '@/components/ui/textarea';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { HandoverDetailLayout } from '../detail/handover-detail-layout.generated';
import {
  useHandoverActionMutation,
  useHandoverHistoryQuery,
  useHandoverQuery,
} from '../hooks/use-handovers';
import type {
  HandoverAction,
  HandoverDocument,
  HandoverItemInput,
} from '../model/handover';
import { HANDOVER_PERMISSION_CODES } from '../model/handover-permissions';

type ReasonAction = 'reject' | 'cancel';
const EMPTY_ITEMS: HandoverDocument['items'] = [];

export function HandoverDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const { userId, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(HANDOVER_PERMISSION_CODES.view);
  const canManage = hasPermission(HANDOVER_PERMISSION_CODES.manage);
  const query = useHandoverQuery(id, isPermissionsPending || canView);
  const historyQuery = useHandoverHistoryQuery(
    id,
    isPermissionsPending || canView,
  );
  const custodiansQuery = useCustodiansQuery(
    true,
    isPermissionsPending || canView,
  );
  const mutation = useHandoverActionMutation();
  const { mutateAsync: mutateHandoverAction, isPending: isActionPending } =
    mutation;
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receiverConditions, setReceiverConditions] = useState<
    HandoverItemInput[]
  >([]);
  const document = query.data;
  const custodianList = custodiansQuery.data ?? [];
  const senderParty = custodianList.find(
    (party) => party.id === document?.senderParty.id,
  );
  const recipientParty = custodianList.find(
    (party) => party.id === document?.recipientParty.id,
  );
  const isSender = Boolean(
    userId &&
    (senderParty?.accountUserId === userId ||
      senderParty?.representativeUserId === userId),
  );
  const isReceiver = Boolean(
    userId &&
    (recipientParty?.accountUserId === userId ||
      recipientParty?.representativeUserId === userId),
  );
  const items = document?.items ?? EMPTY_ITEMS;
  const canEditOrSend = Boolean(
    canManage && isSender && document?.status === 'draft',
  );
  const canCancel = Boolean(
    canManage &&
    isSender &&
    ['draft', 'pending'].includes(document?.status ?? ''),
  );
  const canReceive = Boolean(
    canManage && isReceiver && document?.status === 'pending',
  );

  const runAction = useCallback(
    async (action: HandoverAction, note?: string) => {
      if (!document) return;
      try {
        await mutateHandoverAction({
          id: document.id,
          action,
          expectedVersion: document.version,
          note,
          ...(action === 'confirm'
            ? { itemConditions: receiverConditions }
            : {}),
        });
        const key = `project.handover.toasts.${action === 'send' ? 'sent' : action === 'confirm' ? 'confirmed' : action === 'reject' ? 'rejected' : 'cancelled'}`;
        toast.success(intl.formatMessage({ id: key }));
        setReasonAction(null);
        setReason('');
        setConfirmOpen(false);
      } catch (error) {
        toast.error(getApiErrorMessage(error));
      }
    },
    [document, intl, mutateHandoverAction, receiverConditions],
  );

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
          {canReceive ? (
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
                onClick={() => {
                  setReceiverConditions(
                    items.map((item) => ({
                      materialId: item.materialId,
                      condition: item.condition,
                      note: item.note ?? '',
                    })),
                  );
                  setConfirmOpen(true);
                }}
              >
                <CircleCheck className="size-4" />
                {intl.formatMessage({ id: 'project.handover.actions.confirm' })}
              </Button>
            </>
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
      canReceive,
      document,
      id,
      intl,
      items,
      isActionPending,
      navigate,
      runAction,
    ],
  );
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
  useDetailEntryLayoutHeader(header);

  if (isPermissionsPending)
    return <div className="h-full animate-pulse bg-muted" />;
  if (!canView)
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
    <div className="h-full min-h-0 overflow-y-auto">
      <HandoverDetailLayout
        profile={profile}
        information={information}
        itemsContent={itemsContent}
        historyContent={historyContent}
      />
      <Dialog
        open={reasonAction !== null}
        onOpenChange={(open) =>
          !open && !mutation.isPending && setReasonAction(null)
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
              loading={mutation.isPending}
              loadingText={intl.formatMessage({
                id: 'project.handover.labels.processing',
              })}
              disabled={!reason.trim()}
              onClick={() =>
                reasonAction && void runAction(reasonAction, reason.trim())
              }
            >
              {reasonAction === 'reject'
                ? intl.formatMessage({ id: 'project.handover.actions.reject' })
                : intl.formatMessage({ id: 'project.handover.actions.cancel' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) =>
          !open && !mutation.isPending && setConfirmOpen(false)
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
                  </div>
                  <OptionSelect
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
              loading={mutation.isPending}
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
    </div>
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
