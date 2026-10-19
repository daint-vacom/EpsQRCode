import { useMemo, useState } from 'react';
import { AlertTriangle, Boxes, ExternalLink, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import './material-qr-print.css';
import { buildPath, ROUTES } from '@/constants/routes';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import { useHandoversQuery } from '@/project/handover/hooks/use-handovers';
import { useMaterialGroupsQuery } from '@/project/material-groups/hooks/use-material-groups';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaterialModelImageView } from '../components/material-model-image';
import {
  useApplyMaterialModelSyncMutation,
  useMaterialHistoryQuery,
  useMaterialQuery,
  usePreviewMaterialModelSyncQuery,
} from '../hooks/use-materials';
import type {
  MaterialHistoryEntry,
  MaterialModelSnapshot,
} from '../model/material';
import { MATERIAL_PERMISSION_CODES } from '../model/material-permissions';

export function MaterialDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const queryEnabled = !isPermissionsPending && canView;
  const materialQuery = useMaterialQuery(id, queryEnabled);
  const historyQuery = useMaterialHistoryQuery(id, queryEnabled);
  const material = materialQuery.data;
  const partyQuery = useCustodiansQuery(true, queryEnabled);
  const handoversQuery = useHandoversQuery(
    { materialId: id, page: 1, pageSize: 100 },
    queryEnabled,
  );
  const [activeTab, setActiveTab] = useState('overview');
  const [syncOpen, setSyncOpen] = useState(false);
  const syncPreview = usePreviewMaterialModelSyncQuery(
    id,
    syncOpen && queryEnabled,
  );
  const groupsQuery = useMaterialGroupsQuery(syncOpen && queryEnabled);
  const syncMutation = useApplyMaterialModelSyncMutation();
  const partyNames = useMemo(
    () =>
      new Map((partyQuery.data ?? []).map((party) => [party.id, party.name])),
    [partyQuery.data],
  );
  const modelName =
    material?.nameOverride?.trim() ||
    material?.modelSnapshot.name ||
    intl.formatMessage({ id: 'project.materials.page.detailTitle' });
  const displayImage = material?.imageUrlOverride || undefined;

  const loading = isPermissionsPending || (canView && materialQuery.isPending);
  const retry = () => {
    void materialQuery.refetch();
    void historyQuery.refetch();
    void partyQuery.refetch();
    void handoversQuery.refetch();
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className="py-3">
            <PageHeader
              title={modelName}
              icon={Boxes}
              showBackButton
              backLabel={intl.formatMessage({
                id: 'project.materials.actions.back',
              })}
              onBack={() => navigate(ROUTES.PROJECT.MATERIALS)}
              actions={
                material && canManage ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      disabled={Boolean(material.reservedHandoverId)}
                      title={
                        material.reservedHandoverId
                          ? intl.formatMessage({
                              id: 'project.materials.states.reserved',
                            })
                          : undefined
                      }
                      onClick={() => setSyncOpen(true)}
                    >
                      <RefreshCw />
                      {intl.formatMessage({
                        id: 'project.materials.actions.syncModel',
                      })}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      disabled={Boolean(material.reservedHandoverId)}
                      title={
                        material.reservedHandoverId
                          ? intl.formatMessage({
                              id: 'project.materials.states.reserved',
                            })
                          : undefined
                      }
                      onClick={() =>
                        navigate(
                          buildPath(ROUTES.PROJECT.MATERIAL_EDIT, {
                            id: material.id,
                          }),
                        )
                      }
                    >
                      {intl.formatMessage({
                        id: 'project.materials.actions.edit',
                      })}
                    </Button>
                  </>
                ) : null
              }
            />
          </div>
          {material ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList
                variant="line"
                size="sm"
                className="w-full overflow-x-auto border-b-0"
              >
                <TabsTrigger value="overview">
                  {intl.formatMessage({
                    id: 'project.materials.tabs.overview',
                  })}
                </TabsTrigger>
                <TabsTrigger value="specifications">
                  {intl.formatMessage({
                    id: 'project.materials.tabs.specifications',
                  })}
                </TabsTrigger>
                <TabsTrigger value="handovers">
                  {intl.formatMessage({
                    id: 'project.materials.tabs.handovers',
                  })}
                </TabsTrigger>
                <TabsTrigger value="history">
                  {intl.formatMessage({ id: 'project.materials.tabs.history' })}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {!isPermissionsPending && !canView ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materials.errors.authorizationTitle',
            })}
            description={intl.formatMessage({
              id: 'project.materials.errors.authorization',
            })}
          />
        ) : loading ? (
          <div
            className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
            role="status"
            aria-label={intl.formatMessage({
              id: 'project.materials.states.loading',
            })}
          >
            <Card className="min-h-[500px] animate-pulse" />
            <Card className="min-h-[320px] animate-pulse" />
          </div>
        ) : materialQuery.isError ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materials.errors.loadDetailTitle',
            })}
            description={getApiErrorMessage(materialQuery.error)}
            onRetry={retry}
          />
        ) : !material ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materials.errors.notFoundTitle',
            })}
            description={intl.formatMessage({
              id: 'project.materials.errors.notFound',
            })}
          />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="overview" className="mt-0">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
                <div className="flex min-w-0 flex-col gap-6">
                  <MaterialGallery
                    snapshot={material.modelSnapshot}
                    title={modelName}
                    overrideUrl={displayImage}
                  />
                  <Card>
                    <CardHeader>
                      <CardHeading>
                        <CardTitle>
                          {intl.formatMessage({
                            id: 'project.materials.sections.identity',
                          })}
                        </CardTitle>
                      </CardHeading>
                    </CardHeader>
                    <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                      <Fact
                        label={intl.formatMessage({
                          id: 'project.materials.fields.code',
                        })}
                        value={material.code}
                      />
                      <Fact
                        label={intl.formatMessage({
                          id: 'project.materials.fields.serialNumber',
                        })}
                        value={material.serialNumber}
                      />
                      <Fact
                        label={intl.formatMessage({
                          id: 'project.materials.fields.model',
                        })}
                        value={`${material.modelSnapshot.code} · ${material.modelSnapshot.name}`}
                      />
                      <Fact
                        label={intl.formatMessage({
                          id: 'project.materials.fields.createdAt',
                        })}
                        value={formatDate(material.createdAt)}
                      />
                      <Fact
                        label={intl.formatMessage({
                          id: 'project.materials.fields.description',
                        })}
                        value={
                          material.descriptionOverride ||
                          material.modelSnapshot.description
                        }
                      />
                    </CardContent>
                  </Card>
                </div>
                <aside className="flex min-w-0 flex-col gap-4">
                  <Card>
                    <CardHeader>
                      <CardHeading>
                        <CardTitle>
                          {intl.formatMessage({
                            id: 'project.materials.sections.currentState',
                          })}
                        </CardTitle>
                      </CardHeading>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between gap-3">
                        <span className="text-sm text-muted-foreground">
                          {intl.formatMessage({
                            id: 'project.materials.fields.status',
                          })}
                        </span>
                        <Badge
                          variant={
                            material.status === 'loaned'
                              ? 'warning'
                              : 'secondary'
                          }
                        >
                          {intl.formatMessage({
                            id: `project.materials.status.${material.status}`,
                          })}
                        </Badge>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-sm text-muted-foreground">
                          {intl.formatMessage({
                            id: 'project.materials.fields.condition',
                          })}
                        </span>
                        <Badge
                          variant={
                            material.condition === 'damaged'
                              ? 'destructive'
                              : 'success'
                          }
                        >
                          {intl.formatMessage({
                            id: `project.materials.condition.${material.condition}`,
                          })}
                        </Badge>
                      </div>
                      {material.reservedHandoverId ? (
                        <a
                          className="inline-flex text-sm text-primary underline"
                          href={buildPath(ROUTES.PROJECT.HANDOVER_DETAIL, {
                            id: material.reservedHandoverId,
                          })}
                        >
                          {intl.formatMessage({
                            id: 'project.materials.actions.openReservation',
                          })}
                        </a>
                      ) : null}
                      {material.conditionNote ? (
                        <p className="rounded-md bg-destructive/5 p-3 text-sm">
                          {material.conditionNote}
                        </p>
                      ) : null}
                      {partyQuery.isError ? (
                        <ErrorState
                          title={intl.formatMessage({
                            id: 'project.materials.errors.loadCustodiansTitle',
                          })}
                          description={getApiErrorMessage(partyQuery.error)}
                          onRetry={() => void partyQuery.refetch()}
                        />
                      ) : (
                        <>
                          <Fact
                            label={intl.formatMessage({
                              id: 'project.materials.fields.owner',
                            })}
                            value={
                              partyNames.get(material.ownerPartyId) ??
                              (partyQuery.isPending
                                ? intl.formatMessage({
                                    id: 'project.materials.states.loading',
                                  })
                                : '—')
                            }
                          />
                          <Fact
                            label={intl.formatMessage({
                              id: 'project.materials.fields.borrower',
                            })}
                            value={
                              material.borrowerPartyId
                                ? (partyNames.get(material.borrowerPartyId) ??
                                  (partyQuery.isPending
                                    ? intl.formatMessage({
                                        id: 'project.materials.states.loading',
                                      })
                                    : '—'))
                                : '—'
                            }
                          />
                        </>
                      )}
                    </CardContent>
                  </Card>
                  <QrCard
                    materialId={material.id}
                    code={material.code}
                    name={modelName}
                  />
                  <Card>
                    <CardHeader>
                      <CardHeading>
                        <CardTitle>
                          {intl.formatMessage({
                            id: 'project.materials.sections.modelSnapshot',
                          })}
                        </CardTitle>
                        <CardDescription>
                          {intl.formatMessage({
                            id: 'project.materials.fields.updatedAt',
                          })}
                          : {formatDate(material.modelSnapshot.capturedAt)}
                        </CardDescription>
                      </CardHeading>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {material.descriptionOverride ||
                          material.modelSnapshot.description}
                      </p>
                    </CardContent>
                  </Card>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      navigate(
                        `${ROUTES.PROJECT.HANDOVER_CREATE}?materialId=${encodeURIComponent(material.id)}`,
                      )
                    }
                  >
                    {intl.formatMessage({
                      id: 'project.materials.actions.createHandover',
                    })}
                  </Button>
                </aside>
              </div>
            </TabsContent>
            <TabsContent value="specifications" className="mt-0">
              <SpecificationList
                specifications={material.modelSnapshot.specifications}
                overrides={material.specificationOverrides}
              />
            </TabsContent>
            <TabsContent value="handovers" className="mt-0">
              <RelatedHandovers
                query={handoversQuery}
                materialId={material.id}
                intl={intl}
              />
            </TabsContent>
            <TabsContent value="history" className="mt-0">
              <HistoryList
                query={historyQuery}
                partyNames={partyNames}
                intl={intl}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
      {material && canManage ? (
        <ModelSyncPreviewDialog
          open={syncOpen}
          onOpenChange={setSyncOpen}
          materialId={material.id}
          version={material.version}
          query={syncPreview}
          groups={groupsQuery.data ?? []}
          groupsLoading={groupsQuery.isPending}
          groupsError={
            groupsQuery.isError ? getApiErrorMessage(groupsQuery.error) : null
          }
          onRetryGroups={() => void groupsQuery.refetch()}
          mutation={syncMutation}
          intl={intl}
          onComplete={() => {
            setSyncOpen(false);
            toast.success(
              intl.formatMessage({ id: 'project.materials.toasts.synced' }),
            );
          }}
        />
      ) : null}
    </div>
  );
}

function MaterialGallery({
  snapshot,
  title,
  overrideUrl,
}: {
  snapshot: MaterialModelSnapshot;
  title: string;
  overrideUrl?: string;
}) {
  const intl = useIntl();
  const images = snapshot.images;
  const [activeIndex, setActiveIndex] = useState(0);
  const image = images[activeIndex];
  return (
    <Card className="overflow-hidden">
      <div className="relative flex aspect-[16/10] items-center justify-center bg-muted">
        {overrideUrl ? (
          <img
            src={overrideUrl}
            alt={title}
            className="size-full object-contain"
          />
        ) : image ? (
          <MaterialModelImageView
            image={image}
            alt={title}
            className="size-full object-contain"
          />
        ) : (
          <div className="text-sm text-muted-foreground">{title}</div>
        )}
        {snapshot.requiresInspection ? (
          <Badge className="absolute left-4 top-4" variant="warning">
            <AlertTriangle className="mr-1 size-3.5" />
            {intl.formatMessage({
              id: 'project.materials.fields.requiresInspection',
            })}
          </Badge>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto p-3">
          {images.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Xem ảnh ${index + 1}`}
              aria-current={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={`size-16 shrink-0 overflow-hidden rounded-md border-2 ${activeIndex === index ? 'border-primary' : 'border-border'}`}
            >
              <MaterialModelImageView
                image={item}
                alt=""
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap break-words text-sm font-medium">
        {value || '—'}
      </div>
    </div>
  );
}

function QrCard({
  materialId,
  code,
  name,
}: {
  materialId: string;
  code: string;
  name: string;
}) {
  const intl = useIntl();
  const value = `${window.location.origin}/materials/${materialId}`;
  return (
    <Card className="material-qr-card">
      <CardHeader>
        <CardHeading>
          <CardTitle>
            {intl.formatMessage({ id: 'project.materials.sections.qr' })}
          </CardTitle>
        </CardHeading>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <QRCodeSVG
          value={value}
          data-qr-value={value}
          size={96}
          level="M"
          marginSize={1}
          aria-label={`QR ${code}`}
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className="text-xs text-muted-foreground">{code}</div>
          <a
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline"
            href={value}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="size-3" />
            {intl.formatMessage({ id: 'project.materials.actions.openQrLink' })}
          </a>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 print:hidden"
            onClick={() => window.print()}
          >
            {intl.formatMessage({ id: 'project.materials.actions.printQr' })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SpecificationList({
  specifications,
  overrides,
}: {
  specifications: MaterialModelSnapshot['specifications'];
  overrides: Record<string, string[]>;
}) {
  const intl = useIntl();
  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <CardTitle>
            {intl.formatMessage({
              id: 'project.materials.fields.specifications',
            })}
          </CardTitle>
        </CardHeading>
      </CardHeader>
      <CardContent className="divide-y">
        {specifications.map((spec) => {
          const customized = Object.prototype.hasOwnProperty.call(
            overrides,
            spec.id,
          );
          const values = customized ? overrides[spec.id] : spec.values;
          return (
            <div
              key={spec.id}
              className="grid gap-2 py-3 sm:grid-cols-[220px_minmax(0,1fr)]"
            >
              <div>
                <div className="text-sm font-medium">{spec.name}</div>
                <div className="text-xs text-muted-foreground">
                  {spec.dataType}
                </div>
              </div>
              <div>
                <span className="whitespace-pre-wrap text-sm">
                  {values.join(', ')}
                </span>
                {customized ? (
                  <Badge className="ml-2" variant="info">
                    {intl.formatMessage({
                      id: 'project.materials.fields.customInfo',
                    })}
                  </Badge>
                ) : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RelatedHandovers({
  query,
  materialId,
  intl,
}: {
  query: ReturnType<typeof useHandoversQuery>;
  materialId: string;
  intl: ReturnType<typeof useIntl>;
}) {
  if (query.isPending)
    return (
      <Card
        className="min-h-48 animate-pulse"
        role="status"
        aria-label={intl.formatMessage({
          id: 'project.materials.states.loading',
        })}
      />
    );
  if (query.isError)
    return (
      <ErrorState
        title={intl.formatMessage({
          id: 'project.materials.errors.loadHandoversTitle',
        })}
        description={getApiErrorMessage(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  const documents = query.data?.items ?? [];
  const related = documents
    .map((doc) => ({
      doc,
      item: doc.items.find((entry) => entry.materialId === materialId),
    }))
    .filter((entry) => entry.item);
  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <CardTitle>
            {intl.formatMessage({ id: 'project.materials.tabs.handovers' })}
          </CardTitle>
        </CardHeading>
      </CardHeader>
      <CardContent>
        {related.length ? (
          <div className="divide-y">
            {related.map(({ doc, item }) => (
              <a
                key={`${doc.id}:${item!.id}`}
                href={buildPath(ROUTES.PROJECT.HANDOVER_DETAIL, { id: doc.id })}
                className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-muted/50"
              >
                <div>
                  <div className="font-medium">
                    {doc.code} ·{' '}
                    {intl.formatMessage({
                      id: `project.materials.handoverType.${doc.type}`,
                    })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {doc.senderParty.name} → {doc.recipientParty.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item!.materialName} · {item!.conditionNote}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      doc.status === 'completed' ? 'success' : 'secondary'
                    }
                  >
                    {intl.formatMessage({
                      id: `project.materials.handoverStatus.${doc.status}`,
                    })}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(doc.completedAt ?? doc.createdAt)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="py-5 text-sm text-muted-foreground">
            {intl.formatMessage({ id: 'project.materials.empty.handovers' })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryList({
  query,
  partyNames,
  intl,
}: {
  query: ReturnType<typeof useMaterialHistoryQuery>;
  partyNames: ReadonlyMap<string, string>;
  intl: ReturnType<typeof useIntl>;
}) {
  if (query.isPending)
    return (
      <Card
        className="min-h-48 animate-pulse"
        role="status"
        aria-label={intl.formatMessage({
          id: 'project.materials.states.loading',
        })}
      />
    );
  if (query.isError)
    return (
      <ErrorState
        title={intl.formatMessage({
          id: 'project.materials.errors.loadHistoryTitle',
        })}
        description={getApiErrorMessage(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <CardTitle>
            {intl.formatMessage({ id: 'project.materials.tabs.history' })}
          </CardTitle>
        </CardHeading>
      </CardHeader>
      <CardContent>
        {query.data?.length ? (
          <ol className="space-y-4">
            {query.data.map((entry) => (
              <li key={entry.id} className="border-l-2 border-primary/30 pl-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">
                    {intl.formatMessage({
                      id: `project.materials.history.${entry.action}`,
                    })}
                  </span>
                  <time className="text-xs text-muted-foreground">
                    {formatDate(entry.createdAt)}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {intl.formatMessage({
                    id: 'project.materials.history.actor',
                  })}
                  :{' '}
                  {entry.actorDisplayName ||
                    intl.formatMessage({
                      id: 'project.materials.history.unknownActor',
                    })}
                </p>
                <HistoryChanges
                  entry={entry}
                  partyNames={partyNames}
                  intl={intl}
                />
                {entry.note ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entry.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-5 text-sm text-muted-foreground">
            {intl.formatMessage({ id: 'project.materials.empty.history' })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryChanges({
  entry,
  partyNames,
  intl,
}: {
  entry: MaterialHistoryEntry;
  partyNames: ReadonlyMap<string, string>;
  intl: ReturnType<typeof useIntl>;
}) {
  const keys = [
    'ownerPartyId',
    'borrowerPartyId',
    'condition',
    'conditionNote',
    'status',
    'nameOverride',
    'descriptionOverride',
    'serialNumber',
  ];
  const changed = keys.filter(
    (key) =>
      JSON.stringify(entry.fromState?.[key] ?? null) !==
      JSON.stringify(entry.toState[key] ?? null),
  );
  if (!changed.length) return null;
  const labels: Record<string, string> = {
    ownerPartyId: 'project.materials.fields.owner',
    borrowerPartyId: 'project.materials.fields.borrower',
    condition: 'project.materials.fields.condition',
    conditionNote: 'project.materials.fields.conditionNote',
    status: 'project.materials.fields.status',
    nameOverride: 'project.materials.fields.name',
    descriptionOverride: 'project.materials.fields.description',
    serialNumber: 'project.materials.fields.serialNumber',
  };
  return (
    <dl className="mt-2 space-y-1">
      {changed.map((key) => (
        <div
          key={key}
          className="grid gap-1 text-sm sm:grid-cols-[180px_minmax(0,1fr)]"
        >
          <dt className="text-muted-foreground">
            {intl.formatMessage({ id: labels[key] })}
          </dt>
          <dd>
            {historyValue(key, entry.fromState?.[key], intl, partyNames)} →{' '}
            {historyValue(key, entry.toState[key], intl, partyNames)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function historyValue(
  key: string,
  value: unknown,
  intl: ReturnType<typeof useIntl>,
  partyNames: ReadonlyMap<string, string>,
) {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'condition' && (value === 'good' || value === 'damaged'))
    return intl.formatMessage({ id: `project.materials.condition.${value}` });
  if (key === 'status' && (value === 'available' || value === 'loaned'))
    return intl.formatMessage({ id: `project.materials.status.${value}` });
  if (
    (key === 'ownerPartyId' || key === 'borrowerPartyId') &&
    typeof value === 'string'
  )
    return (
      partyNames.get(value) ??
      intl.formatMessage({ id: 'project.materials.history.unknownParty' })
    );
  if (typeof value === 'string') return value;
  return intl.formatMessage({ id: 'project.materials.history.changed' });
}

function ModelSyncPreviewDialog({
  open,
  onOpenChange,
  materialId,
  version,
  query,
  groups,
  groupsLoading,
  groupsError,
  onRetryGroups,
  mutation,
  intl,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialId: string;
  version: number;
  query: ReturnType<typeof usePreviewMaterialModelSyncQuery>;
  groups: { id: string; name: string; code: string }[];
  groupsLoading: boolean;
  groupsError: string | null;
  onRetryGroups: () => void;
  mutation: ReturnType<typeof useApplyMaterialModelSyncMutation>;
  intl: ReturnType<typeof useIntl>;
  onComplete: () => void;
}) {
  const preview = query.data;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {intl.formatMessage({ id: 'project.materials.sync.title' })}
          </DialogTitle>
          <DialogDescription>
            {intl.formatMessage({ id: 'project.materials.sync.description' })}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto py-4">
          {query.isPending ? (
            <div
              className="h-24 animate-pulse rounded bg-muted"
              role="status"
            />
          ) : null}
          {query.isError ? (
            <ErrorState
              title={intl.formatMessage({
                id: 'project.materials.errors.loadSyncTitle',
              })}
              description={getApiErrorMessage(query.error)}
              onRetry={() => void query.refetch()}
            />
          ) : null}
          {query.data ? (
            <>
              <ul className="space-y-2">
                {query.data.changedFields.map((field) => (
                  <li
                    key={field}
                    className="grid gap-1 text-sm sm:grid-cols-[180px_minmax(0,1fr)]"
                  >
                    <span className="font-medium">
                      {syncFieldLabel(
                        field,
                        query.data.currentSnapshot.specifications,
                        intl,
                      )}
                    </span>
                    <span className="whitespace-pre-wrap text-muted-foreground">
                      {syncFieldValue(
                        field,
                        query.data.currentSnapshot,
                        groups,
                        groupsLoading,
                      )}{' '}
                      →{' '}
                      {syncFieldValue(
                        field,
                        query.data.proposedSnapshot,
                        groups,
                        groupsLoading,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {groupsError ? (
                <ErrorState
                  title={intl.formatMessage({
                    id: 'project.materials.errors.loadGroupsTitle',
                  })}
                  description={groupsError}
                  onRetry={onRetryGroups}
                />
              ) : null}
              {query.data.preservedOverrides.length ? (
                <div className="rounded-md bg-muted p-3">
                  <div className="text-sm font-medium">
                    {intl.formatMessage({
                      id: 'project.materials.sync.preserved',
                    })}
                  </div>
                  <div className="mt-1 text-sm">
                    {query.data.preservedOverrides
                      .map((field) =>
                        preservedFieldLabel(
                          field,
                          query.data.currentSnapshot.specifications,
                          intl,
                        ),
                      )
                      .join(', ')}
                  </div>
                </div>
              ) : null}
              {!query.data.changedFields.length ? (
                <p className="text-sm text-muted-foreground">
                  {intl.formatMessage({ id: 'project.materials.sync.empty' })}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            {intl.formatMessage({ id: 'project.materials.actions.cancel' })}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!preview?.changedFields.length || mutation.isPending}
            loading={mutation.isPending}
            loadingText={intl.formatMessage({
              id: 'project.materials.actions.syncing',
            })}
            onClick={() =>
              preview &&
              mutation.mutate(
                {
                  id: materialId,
                  expectedVersion: version,
                  expectedModelUpdatedAt: preview.modelUpdatedAt,
                },
                {
                  onSuccess: onComplete,
                  onError: (error) => toast.error(getApiErrorMessage(error)),
                },
              )
            }
          >
            {intl.formatMessage({
              id: 'project.materials.actions.confirmSync',
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function syncFieldLabel(
  field: string,
  specifications: MaterialModelSnapshot['specifications'],
  intl: ReturnType<typeof useIntl>,
) {
  const uuid = field.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0];
  const specification = specifications.find(
    (item) => item.id === uuid || field === item.id,
  );
  if (specification)
    return intl.formatMessage(
      { id: 'project.materials.sync.specification' },
      { name: specification.name },
    );
  if (field === 'groupId')
    return intl.formatMessage({ id: 'project.materials.sync.groupChanged' });
  const ids: Record<string, string> = {
    code: 'project.materials.fields.code',
    name: 'project.materials.fields.model',
    groupId: 'project.materials.fields.group',
    description: 'project.materials.fields.description',
    images: 'project.materials.fields.image',
    requiresInspection: 'project.materials.fields.requiresInspection',
    specifications: 'project.materials.fields.specifications',
  };
  return intl.formatMessage({
    id: ids[field] ?? 'project.materials.sync.modelInformation',
  });
}

function syncFieldValue(
  field: string,
  snapshot: MaterialModelSnapshot,
  groups: { id: string; name: string; code: string }[],
  groupsLoading: boolean,
) {
  const uuid = field.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0];
  const specification = snapshot.specifications.find(
    (item) => item.id === uuid || field === item.id,
  );
  if (specification) return specification.values.join(', ');
  if (field === 'groupId')
    return snapshot.groupId
      ? (groups.find((group) => group.id === snapshot.groupId)?.name ??
          (groupsLoading ? 'Đang tải' : 'Nhóm không xác định'))
      : 'Không phân nhóm';
  if (field === 'images') return `${snapshot.images.length} ảnh`;
  if (field === 'specifications')
    return (
      snapshot.specifications
        .map((item) => `${item.name}: ${item.values.join(', ') || '—'}`)
        .join('\n') || 'Không có thông số'
    );
  const value = snapshot[field as keyof MaterialModelSnapshot];
  if (Array.isArray(value))
    return value
      .map((item) => (typeof item === 'string' ? item : 'Thông tin mẫu'))
      .join(', ');
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  return typeof value === 'string' ? value : '—';
}

function preservedFieldLabel(
  field: string,
  specifications: MaterialModelSnapshot['specifications'],
  intl: ReturnType<typeof useIntl>,
) {
  const uuid = field.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0];
  const specification = specifications.find(
    (item) => item.id === uuid || field === item.id,
  );
  if (specification) return specification.name;
  return intl.formatMessage({ id: 'project.materials.fields.customInfo' });
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
