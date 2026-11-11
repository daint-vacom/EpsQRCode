import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  Boxes,
  ClipboardCheck,
  ClipboardPenLine,
  Factory,
  HardHat,
  History,
  Info,
  LockKeyhole,
  Maximize2,
  MessageSquareWarning,
  PackageX,
  Printer,
  QrCode,
  ShieldCheck,
  StickyNote,
  UserRound,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import Lightbox from 'yet-another-react-lightbox';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Inline from 'yet-another-react-lightbox/plugins/inline';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import { buildPath, ROUTES } from '@/constants/routes';
import { useMaterialGroupsQuery } from '@/project/material-groups/hooks/use-material-groups';
import { useMaterialLabelPrintSnapshotQuery } from '@/project/material-labels/hooks/use-material-label-templates';
import { MATERIAL_MODEL_IMAGES_BUCKET } from '@/project/material-models/api/material-models.api';
import { MaterialSafetyInspectionsPanel } from '@/project/material-safety-inspections/components/material-safety-inspections-panel';
import { useIntl } from 'react-intl';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { createSignedStorageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTable,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageBackButton } from '@/components/ui/page-back-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaterialQrCodeHoverCard } from '../components/material-qr-code-hover-card';
import { useRecordMaterialQrScanMutation } from '../hooks/use-material-qr-tracking';
import {
  useMaterialQuery,
  usePublicMaterialDetailQuery,
} from '../hooks/use-materials';
import {
  getMaterialInspectionSettings,
  getMaterialSafetyInspectionChecklist,
  type Material,
  type MaterialPublicDetail,
} from '../model/material';
import { MATERIAL_PERMISSION_CODES } from '../model/material-permissions';
import '@/project/material-labels/pages/material-label-print.css';

const MATERIAL_DETAIL_TABS = [
  { value: 'general', messageId: 'project.materials.tabs.general', icon: Info },
  {
    value: 'handovers',
    messageId: 'project.materials.tabs.handoverHistory',
    icon: History,
  },
  {
    value: 'inventory',
    messageId: 'project.materials.tabs.inventoryHistory',
    icon: ClipboardCheck,
  },
  {
    value: 'safety',
    messageId: 'project.materials.tabs.safety',
    icon: ClipboardPenLine,
  },
  {
    value: 'repairs',
    messageId: 'project.materials.tabs.repairs',
    icon: Wrench,
  },
  {
    value: 'feedback',
    messageId: 'project.materials.tabs.feedback',
    icon: MessageSquareWarning,
  },
] as const;

type MaterialDetailTabValue = (typeof MATERIAL_DETAIL_TABS)[number]['value'];
type GallerySlide = { src: string; alt: string; imageFit: 'contain' };

export function MaterialDetailPage({
  publicMode = false,
}: {
  publicMode?: boolean;
}) {
  const intl = useIntl();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const { id = '' } = useParams();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const queryEnabled = !publicMode && !isPermissionsPending && canView;
  const materialQuery = useMaterialQuery(id, queryEnabled);
  const publicDetailQuery = usePublicMaterialDetailQuery(id, publicMode);
  const material = publicMode ? undefined : materialQuery.data;
  const publicDetail = publicMode ? publicDetailQuery.data : undefined;
  const scanRequested = new URLSearchParams(search).get('open') === 'scan';
  const hasLoadedMaterial = publicMode
    ? Boolean(publicDetail?.basicInfo)
    : Boolean(material);
  const scanAttemptedForMaterial = useRef<string | null>(null);
  const { mutate: mutateQrScan } = useRecordMaterialQrScanMutation();

  useEffect(() => {
    if (!scanRequested) {
      scanAttemptedForMaterial.current = null;
      return;
    }
    if (!id || !hasLoadedMaterial || scanAttemptedForMaterial.current === id) {
      return;
    }

    scanAttemptedForMaterial.current = id;
    mutateQrScan(id, {
      onSuccess: (recorded) => {
        if (scanAttemptedForMaterial.current !== id) return;
        if (!recorded) {
          scanAttemptedForMaterial.current = null;
          return;
        }

        const nextSearchParams = new URLSearchParams(search);
        nextSearchParams.delete('open');
        const nextSearch = nextSearchParams.toString();
        navigate(
          {
            pathname,
            search: nextSearch ? `?${nextSearch}` : '',
            hash,
          },
          { replace: true },
        );
      },
      onError: () => {
        if (scanAttemptedForMaterial.current === id) {
          scanAttemptedForMaterial.current = null;
        }
      },
    });
  }, [
    hasLoadedMaterial,
    hash,
    id,
    mutateQrScan,
    navigate,
    pathname,
    scanRequested,
    search,
  ]);
  const groupsQuery = useMaterialGroupsQuery(queryEnabled && Boolean(material));
  const [activeTab, setActiveTab] = useState<MaterialDetailTabValue>('general');
  const modelName = publicMode
    ? publicDetail?.basicInfo?.name ||
      intl.formatMessage({ id: 'project.materials.page.detailTitle' })
    : material?.nameOverride?.trim() ||
      material?.modelSnapshot.name ||
      intl.formatMessage({ id: 'project.materials.page.detailTitle' });
  const isLoading = publicMode
    ? publicDetailQuery.isPending
    : isPermissionsPending || (canView && materialQuery.isPending);
  const group = groupsQuery.data?.find(
    (item) => item.id === material?.modelSnapshot.groupId,
  );

  if (
    publicMode &&
    !isLoading &&
    !publicDetailQuery.isError &&
    !publicDetail?.basicInfo
  ) {
    return (
      <div className="fixed inset-0 flex h-dvh w-full items-center justify-center bg-muted">
        <EmptyState
          icon={PackageX}
          iconSize="lg"
          title={intl.formatMessage({
            id: 'project.materials.publicDetail.unavailable',
          })}
          description={intl.formatMessage({
            id: 'project.materials.publicDetail.unavailableDescription',
          })}
          className="flex-1"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex h-dvh min-h-0 w-full min-w-0 flex-col overflow-hidden bg-muted">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as MaterialDetailTabValue)}
        className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted"
      >
        <header className="z-10 w-full shrink-0 border-b border-admin-neutral-100 bg-card">
          <DetailShell>
            <div className="flex items-center justify-between gap-4 pt-4 pb-1">
              <div className="flex min-w-0 items-center gap-3">
                <PageBackButton
                  onClick={() =>
                    navigate(publicMode ? -1 : ROUTES.PROJECT.MATERIALS)
                  }
                  label={intl.formatMessage({
                    id: 'project.materials.actions.back',
                  })}
                />
                <h1 className="truncate text-sm font-medium text-admin-neutral-800 md:text-base">
                  {modelName}
                </h1>
              </div>
              {material && canManage && !publicMode ? (
                <Button
                  type="button"
                  size="md"
                  className="shrink-0"
                  onClick={() =>
                    navigate(
                      buildPath(ROUTES.PROJECT.MATERIAL_EDIT, {
                        id: material.id,
                      }),
                    )
                  }
                >
                  {intl.formatMessage({ id: 'project.materials.actions.edit' })}
                </Button>
              ) : null}
            </div>
            <TabsList
              variant="line"
              className="w-full min-w-0 overflow-x-auto border-b-0"
            >
              {MATERIAL_DETAIL_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    <Icon />
                    {intl.formatMessage({ id: tab.messageId })}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </DetailShell>
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain py-8">
          <DetailShell>
            {!publicMode && !isPermissionsPending && !canView ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.materials.errors.authorizationTitle',
                })}
                description={intl.formatMessage({
                  id: 'project.materials.errors.authorization',
                })}
              />
            ) : isLoading ? (
              <div
                className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]"
                role="status"
                aria-label={intl.formatMessage({
                  id: 'project.materials.states.loading',
                })}
              >
                <Card className="aspect-4/3 animate-pulse sm:aspect-[16/10]" />
                <Card className="min-h-80 animate-pulse" />
              </div>
            ) : (
                publicMode ? publicDetailQuery.isError : materialQuery.isError
              ) ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.materials.errors.loadDetailTitle',
                })}
                description={getApiErrorMessage(
                  publicMode ? publicDetailQuery.error : materialQuery.error,
                )}
                onRetry={() =>
                  void (publicMode
                    ? publicDetailQuery.refetch()
                    : materialQuery.refetch())
                }
              />
            ) : (publicMode ? !publicDetail : !material) ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.materials.errors.notFoundTitle',
                })}
                description={intl.formatMessage({
                  id: 'project.materials.errors.notFound',
                })}
              />
            ) : (
              <>
                <TabsContent
                  value="general"
                  className="mt-0 data-[state=inactive]:hidden"
                  forceMount
                >
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
                    <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-6">
                      <div className="order-1 min-w-0 xl:order-none">
                        {publicMode ? (
                          publicDetail?.basicInfo ? (
                            <MaterialGalleryCard
                              title={modelName}
                              publicImages={publicDetail.basicInfo.images}
                            />
                          ) : null
                        ) : material ? (
                          <MaterialGalleryCard
                            material={material}
                            title={modelName}
                          />
                        ) : null}
                      </div>
                      <div className="order-3 min-w-0 xl:order-none">
                        <MaterialSpecificationsCard
                          material={material}
                          publicMode={publicMode}
                          publicSpecifications={publicDetail?.specifications}
                        />
                      </div>
                    </div>
                    <div className="order-2 min-w-0 xl:order-none">
                      <MaterialSummarySidebar
                        material={material}
                        materialId={id}
                        publicMode={publicMode}
                        publicBasicInfo={publicDetail?.basicInfo}
                        groupName={group?.name}
                        groupLoading={groupsQuery.isPending}
                        groupError={groupsQuery.isError}
                        onRetryGroup={() => void groupsQuery.refetch()}
                        ownerName={material?.ownerSnapshot.name}
                        representativeName={
                          material?.ownerSnapshot.representativeName
                        }
                        ownerLoading={false}
                        ownerError={false}
                      />
                    </div>
                  </div>
                </TabsContent>
                {MATERIAL_DETAIL_TABS.filter(
                  (tab) => tab.value !== 'general',
                ).map((tab) => (
                  <TabsContent
                    key={tab.value}
                    value={tab.value}
                    className="mt-0"
                  >
                    {tab.value === 'safety' && !publicMode && material ? (
                      <MaterialSafetyInspectionsPanel
                        materialId={material.id}
                        canManage={canManage}
                        hasChecklist={
                          getMaterialSafetyInspectionChecklist(material)
                            .length > 0
                        }
                        requiresInspection={
                          getMaterialInspectionSettings(material)
                            .requiresInspection
                        }
                      />
                    ) : null}
                  </TabsContent>
                ))}
              </>
            )}
          </DetailShell>
        </main>
      </Tabs>
    </div>
  );
}

function DetailShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      {children}
    </div>
  );
}

function PublicHiddenContent() {
  const intl = useIntl();
  return (
    <div className="flex min-h-24 flex-col items-center justify-center gap-2 py-5 text-center text-sm text-muted-foreground">
      <LockKeyhole className="size-5" aria-hidden="true" />
      <span>
        {intl.formatMessage({ id: 'project.materials.publicDetail.notShared' })}
      </span>
    </div>
  );
}

function MaterialGalleryCard({
  material,
  publicImages,
  title,
}: {
  material?: Material;
  publicImages?: Material['images'];
  title: string;
}) {
  const intl = useIntl();
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [slides, setSlides] = useState<GallerySlide[]>([]);
  const sourceImages = useMemo(() => {
    if (!material) return publicImages ?? [];
    return material.images.length > 0
      ? material.images
      : material.modelSnapshot.images.map((image) => ({
          ...image,
          storageBucket: MATERIAL_MODEL_IMAGES_BUCKET,
          url: '',
        }));
  }, [material, publicImages]);

  useEffect(() => {
    let cancelled = false;
    setActiveIndex(0);

    if (sourceImages.length === 0) {
      setSlides([]);
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(
      [...sourceImages]
        .sort(
          (first, second) =>
            Number(second.isCover) - Number(first.isCover) ||
            first.sortOrder - second.sortOrder,
        )
        .map(async (image) => {
          const src =
            image.externalUrl ||
            image.url ||
            (image.storagePath && image.storageBucket
              ? await createSignedStorageUrl(
                  image.storageBucket,
                  image.storagePath,
                  3600,
                ).catch(() => '')
              : '');
          return src ? { src, alt: title, imageFit: 'contain' as const } : null;
        }),
    ).then((resolved) => {
      if (!cancelled) setSlides(resolved.filter((slide) => slide !== null));
    });

    return () => {
      cancelled = true;
    };
  }, [material?.id, sourceImages, title]);

  const activeImage = slides[activeIndex];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-admin-neutral-100 bg-black sm:aspect-[16/10]">
        {slides.length > 0 ? (
          <Lightbox
            plugins={[Inline]}
            inline={{ className: 'material-gallery-inline size-full bg-black' }}
            slides={slides}
            index={activeIndex}
            carousel={{
              finite: true,
              imageFit: 'contain',
              padding: 0,
              spacing: 0,
            }}
            toolbar={{ buttons: [] }}
            render={{ buttonPrev: () => null, buttonNext: () => null }}
            on={{
              view: ({ index }) => setActiveIndex(index),
              click: ({ index }) => {
                setActiveIndex(index);
                setLightboxOpen(true);
              },
            }}
            labels={{
              Carousel: 'Thư viện ảnh vật tư',
              Slide: 'Ảnh vật tư',
              '{index} of {total}': '{index} / {total}',
            }}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-white">
            {title}
          </div>
        )}
        {slides.length > 0 ? (
          <button
            type="button"
            aria-label={intl.formatMessage({
              id: 'project.materials.actions.expandImage',
            })}
            onClick={() => setLightboxOpen(true)}
            className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Maximize2 className="size-4" />
          </button>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-t from-black/65 to-transparent px-4 py-3">
          <span className="truncate text-sm font-medium text-white">
            {activeImage?.alt ?? title}
          </span>
          {slides.length > 0 ? (
            <span className="shrink-0 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-white">
              {activeIndex + 1}/{slides.length}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {slides.map((slide, index) => (
          <button
            key={`${slide.src}-${index}`}
            type="button"
            aria-label={`${intl.formatMessage({ id: 'project.materials.actions.viewImage' })} ${slide.alt}`}
            aria-current={index === activeIndex}
            onClick={() => setActiveIndex(index)}
            className={cn(
              'h-2 rounded-full transition-all',
              index === activeIndex
                ? 'w-5 bg-admin-primary'
                : 'w-2 bg-admin-neutral-500/40 hover:bg-admin-neutral-500/70',
            )}
          />
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {slides.map((slide, index) => (
          <button
            key={`${slide.src}-${index}-thumbnail`}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`${intl.formatMessage({ id: 'project.materials.actions.viewImage' })} ${slide.alt}`}
            aria-current={index === activeIndex}
            className={cn(
              'relative size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-black transition-colors',
              index === activeIndex
                ? 'border-admin-primary'
                : 'border-admin-neutral-100 hover:border-admin-neutral-500',
            )}
          >
            <img
              src={slide.src}
              alt={slide.alt}
              className={cn(
                'size-full object-contain transition-opacity',
                index === activeIndex ? 'opacity-100' : 'opacity-70',
              )}
              loading="lazy"
            />
          </button>
        ))}
      </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={slides}
        index={activeIndex}
        plugins={[Zoom, Fullscreen]}
        carousel={{ finite: true, imageFit: 'contain' }}
        on={{ view: ({ index }) => setActiveIndex(index) }}
        labels={{
          Previous: 'Ảnh trước',
          Next: 'Ảnh sau',
          Close: 'Đóng',
          Slide: 'Ảnh vật tư',
          Carousel: 'Thư viện ảnh vật tư',
          Lightbox: 'Xem ảnh vật tư',
          '{index} of {total}': '{index} / {total}',
        }}
      />
    </div>
  );
}

function MaterialSpecificationsCard({
  material,
  publicMode = false,
  publicSpecifications,
}: {
  material?: Material;
  publicMode?: boolean;
  publicSpecifications?: MaterialPublicDetail['specifications'];
}) {
  const intl = useIntl();
  const specifications = useMemo(() => {
    if (publicMode) return publicSpecifications ?? [];
    if (!material) return [];
    const hiddenSpecificationIds = new Set(
      material.modelSnapshot.hiddenSpecificationIds ?? [],
    );
    return material.modelSnapshot.specifications
      .filter((specification) => !hiddenSpecificationIds.has(specification.id))
      .map((specification) => {
        const hasOverride = Object.prototype.hasOwnProperty.call(
          material.specificationOverrides,
          specification.id,
        );
        const values = hasOverride
          ? material.specificationOverrides[specification.id]
          : specification.values.length === 1
            ? [specification.values[0]]
            : [];
        const labelsByValue = new Map(
          specification.values.map((value, index) => [
            value,
            specification.valueLabels[index],
          ]),
        );
        const labelOverrides =
          material.specificationOverrideLabels[specification.id] ?? [];

        return {
          ...specification,
          values,
          valueLabels:
            specification.dataType === 'color'
              ? values.map((value, index) =>
                  Object.prototype.hasOwnProperty.call(labelOverrides, index)
                    ? labelOverrides[index]
                    : (labelsByValue.get(value) ?? ''),
                )
              : specification.valueLabels,
        };
      });
  }, [material, publicMode, publicSpecifications]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>
          {intl.formatMessage({
            id: 'project.materials.sections.specifications',
          })}
        </CardTitle>
      </CardHeader>
      {publicMode && publicSpecifications == null ? (
        <CardContent>
          <PublicHiddenContent />
        </CardContent>
      ) : (
        <CardTable>
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[42%]" />
              <col className="w-[58%]" />
            </colgroup>
            <thead className="bg-muted">
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 text-xs font-semibold text-secondary-foreground sm:px-4">
                  {intl.formatMessage({
                    id: 'project.materials.fields.specificationName',
                  })}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-secondary-foreground sm:px-4">
                  {intl.formatMessage({
                    id: 'project.materials.fields.specificationValue',
                  })}
                </th>
              </tr>
            </thead>
            <tbody>
              {specifications.map((specification) => (
                <tr
                  key={specification.id}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="break-words whitespace-normal px-3 py-2.5 align-top font-medium text-admin-neutral-800 sm:px-4">
                    {specification.name}
                  </td>
                  <td className="break-words whitespace-normal px-3 py-2.5 align-top text-admin-neutral-700 sm:px-4">
                    {specification.values
                      .map((value, valueIndex) => {
                        if (specification.dataType !== 'color') return value;
                        return specification.valueLabels[valueIndex] || value;
                      })
                      .join(', ')}
                  </td>
                </tr>
              ))}
              {specifications.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="px-3 py-4 text-sm text-muted-foreground sm:px-4"
                  >
                    {intl.formatMessage({
                      id: 'project.materials.empty.specifications',
                    })}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardTable>
      )}
    </Card>
  );
}

function MaterialSummarySidebar({
  material,
  materialId,
  publicMode = false,
  publicBasicInfo,
  groupName,
  groupLoading,
  groupError,
  onRetryGroup,
  ownerName,
  representativeName,
  ownerLoading,
  ownerError,
  onRetryOwner,
}: {
  material?: Material;
  materialId: string;
  publicMode?: boolean;
  publicBasicInfo?: MaterialPublicDetail['basicInfo'];
  groupName?: string;
  groupLoading: boolean;
  groupError: boolean;
  onRetryGroup: () => void;
  ownerName?: string;
  representativeName?: string | null;
  ownerLoading: boolean;
  ownerError: boolean;
  onRetryOwner?: () => void;
}) {
  const intl = useIntl();
  if (publicMode) {
    return (
      <aside className="flex min-w-0 flex-col gap-4">
        <PublicInfoCard
          title={intl.formatMessage({
            id: 'project.materials.sections.materialInfo',
          })}
          icon={Info}
        >
          {publicBasicInfo ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <FactIcon icon={QrCode} tone="primary" />
                <Fact
                  label={intl.formatMessage({
                    id: 'project.materials.fields.code',
                  })}
                  value={publicBasicInfo.code}
                  className="flex min-w-0 flex-1 flex-col"
                />
                <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-admin-primary-foam bg-white p-1">
                  <MaterialQrCodeHoverCard
                    materialId={materialId}
                    materialCode={publicBasicInfo.code}
                    size={56}
                    previewSize={240}
                  />
                </span>
              </div>
              <DetailFact
                icon={Boxes}
                label={intl.formatMessage({
                  id: 'project.materials.fields.group',
                })}
                value={publicBasicInfo.groupName}
                tone="muted"
              />
              <DetailFact
                icon={Factory}
                label={intl.formatMessage({
                  id: 'project.materials.fields.managedBy',
                })}
                value={publicBasicInfo.ownerName}
                tone="primary"
              />
              {publicBasicInfo.representativeName ? (
                <DetailFact
                  icon={UserRound}
                  label={intl.formatMessage({
                    id: 'project.materials.fields.representative',
                  })}
                  value={publicBasicInfo.representativeName}
                  tone="muted"
                />
              ) : null}
              {publicBasicInfo.note ? (
                <DetailFact
                  icon={StickyNote}
                  label={intl.formatMessage({
                    id: 'project.materials.fields.note',
                  })}
                  value={publicBasicInfo.note}
                  tone="muted"
                />
              ) : null}
            </div>
          ) : (
            <PublicHiddenContent />
          )}
        </PublicInfoCard>

        <MaterialQrLabelCard
          materialId={materialId}
          publicMode
          publicPreview={publicBasicInfo?.lastPrintedLabel}
        />

        <PublicInfoCard
          title={intl.formatMessage({
            id: 'project.materials.sections.currentState',
          })}
          icon={ShieldCheck}
          tone="blue"
        >
          {publicBasicInfo ? (
            <div className="rounded-2xl border border-admin-blue-border bg-admin-blue-bg p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-admin-blue-primary text-white">
                  <HardHat className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="text-[11px] font-medium text-admin-blue-dark">
                    {intl.formatMessage({
                      id: `project.materials.status.${publicBasicInfo.status}`,
                    })}
                  </span>
                  <span className="text-sm font-medium text-admin-neutral-800">
                    {intl.formatMessage({
                      id: `project.materials.condition.${publicBasicInfo.condition}`,
                    })}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <PublicHiddenContent />
          )}
        </PublicInfoCard>
      </aside>
    );
  }
  if (!material) return null;

  const statusText = intl.formatMessage({
    id: `project.materials.status.${material.status}`,
  });

  return (
    <aside className="flex min-w-0 flex-col gap-4">
      <PublicInfoCard
        title={intl.formatMessage({
          id: 'project.materials.sections.materialInfo',
        })}
        icon={Info}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <FactIcon icon={QrCode} tone="primary" />
            <Fact
              label={intl.formatMessage({
                id: 'project.materials.fields.code',
              })}
              value={material.code}
              className="flex min-w-0 flex-1 flex-col"
            />
            <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-admin-primary-foam bg-white p-1">
              <MaterialQrCodeHoverCard
                materialId={material.id}
                materialCode={material.code}
                size={56}
                previewSize={240}
              />
            </span>
          </div>
          <DetailFact
            icon={Boxes}
            label={intl.formatMessage({ id: 'project.materials.fields.group' })}
            value={groupName}
            pending={groupLoading}
            error={groupError}
            onRetry={onRetryGroup}
            tone="muted"
          />
          <DetailFact
            icon={Factory}
            label={intl.formatMessage({
              id: 'project.materials.fields.managedBy',
            })}
            value={ownerName}
            pending={ownerLoading}
            error={ownerError}
            onRetry={onRetryOwner}
            tone="primary"
          />
          {representativeName ? (
            <DetailFact
              icon={UserRound}
              label={intl.formatMessage({
                id: 'project.materials.fields.representative',
              })}
              value={representativeName}
              tone="muted"
            />
          ) : null}
          {material.note ? (
            <DetailFact
              icon={StickyNote}
              label={intl.formatMessage({
                id: 'project.materials.fields.note',
              })}
              value={material.note}
              tone="muted"
            />
          ) : null}
        </div>
      </PublicInfoCard>

      <MaterialQrLabelCard materialId={material.id} />

      <PublicInfoCard
        title={intl.formatMessage({
          id: 'project.materials.sections.currentState',
        })}
        icon={ShieldCheck}
        tone="blue"
      >
        <div className="rounded-2xl border border-admin-blue-border bg-admin-blue-bg p-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-admin-blue-primary text-white">
              <HardHat className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] font-medium text-admin-blue-dark">
                {statusText}
              </span>
              <span className="text-sm font-medium text-admin-neutral-800">
                {intl.formatMessage({
                  id: `project.materials.condition.${material.condition}`,
                })}
              </span>
            </div>
          </div>
        </div>
      </PublicInfoCard>
    </aside>
  );
}

function MaterialQrLabelCard({
  materialId,
  publicMode = false,
  publicPreview,
}: {
  materialId: string;
  publicMode?: boolean;
  publicPreview?: NonNullable<
    MaterialPublicDetail['basicInfo']
  >['lastPrintedLabel'];
}) {
  const intl = useIntl();
  const printSnapshotQuery = useMaterialLabelPrintSnapshotQuery(
    materialId,
    !publicMode,
  );
  const printSnapshot = printSnapshotQuery.data;
  const previewSvg = publicMode
    ? publicPreview?.previewSvg
    : printSnapshot?.previewSvg;
  const widthMm = publicMode
    ? publicPreview?.widthMm
    : printSnapshot?.templateSnapshot?.widthMm;
  const heightMm = publicMode
    ? publicPreview?.heightMm
    : printSnapshot?.templateSnapshot?.heightMm;

  useEffect(() => {
    if (!previewSvg || !widthMm || !heightMm) return;
    const style = document.createElement('style');
    style.dataset.materialLabelPrint = 'true';
    style.textContent = `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }`;
    document.head.append(style);
    return () => style.remove();
  }, [previewSvg, widthMm, heightMm]);

  return (
    <>
      <PublicInfoCard
        title={intl.formatMessage({
          id: 'project.materials.sections.printedQrLabel',
        })}
        icon={QrCode}
      >
        {!publicMode && printSnapshotQuery.isPending ? (
          <div className="flex min-h-28 items-center justify-center rounded-lg border border-admin-neutral-300 bg-white p-4">
            <Skeleton className="h-20 w-36 rounded" />
          </div>
        ) : !publicMode && printSnapshotQuery.isError ? (
          <div className="flex min-h-24 items-center justify-between gap-3 rounded-lg border border-admin-neutral-300 bg-white p-3 text-sm">
            <span className="text-destructive">
              {intl.formatMessage({
                id: 'project.materials.states.loadFailed',
              })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => void printSnapshotQuery.refetch()}
            >
              {intl.formatMessage({ id: 'project.materials.actions.retry' })}
            </Button>
          </div>
        ) : previewSvg ? (
          <div className="flex min-h-28 items-center justify-center overflow-hidden rounded bg-white p-2">
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`}
              alt={intl.formatMessage({
                id: 'project.materials.states.lastPrintedLabel',
              })}
              className="max-h-48 max-w-full object-contain"
            />
          </div>
        ) : (
          <p className="text-sm text-admin-neutral-600">
            {intl.formatMessage({
              id: 'project.materials.states.notPrintedLabel',
            })}
          </p>
        )}
        {previewSvg && widthMm && heightMm ? (
          <div className="mt-3 flex justify-end">
            <Button type="button" size="md" onClick={() => window.print()}>
              <Printer />
              {intl.formatMessage({
                id: 'project.materials.actions.printLabel',
              })}
            </Button>
          </div>
        ) : null}
      </PublicInfoCard>
      {previewSvg && widthMm && heightMm
        ? createPortal(
            <div
              className="material-label-print-document"
              style={
                {
                  '--material-label-width': `${widthMm}mm`,
                  '--material-label-height': `${heightMm}mm`,
                } as CSSProperties
              }
            >
              <div className="material-label-print-item">
                <img
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`}
                  alt=""
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function PublicInfoCard({
  title,
  icon: Icon,
  tone = 'primary',
  children,
}: {
  title: string;
  icon: LucideIcon;
  tone?: 'primary' | 'blue';
  children: ReactNode;
}) {
  const toneClasses = {
    primary: {
      header: 'text-admin-primary-dark',
      icon: 'bg-admin-primary-bg text-admin-primary-dark',
    },
    blue: {
      header: 'text-admin-blue-dark',
      icon: 'bg-admin-blue-primary text-white',
    },
  }[tone];

  return (
    <Card className="overflow-hidden">
      <CardHeader className={cn('justify-start gap-2', toneClasses.header)}>
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-lg',
            toneClasses.icon,
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <CardTitle className="text-[12px] font-semibold tracking-[0.08em]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DetailFact({
  icon: Icon,
  label,
  value,
  tone,
  pending = false,
  error = false,
  onRetry,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
  tone: 'primary' | 'muted';
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const intl = useIntl();
  return (
    <div className="flex items-center gap-3">
      <FactIcon icon={Icon} tone={tone} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-medium tracking-[0.04em] text-admin-neutral-500">
          {label}
        </span>
        {error ? (
          <span className="flex items-center gap-1 text-xs text-destructive">
            {intl.formatMessage({ id: 'project.materials.states.loadFailed' })}
            {onRetry ? (
              <button type="button" className="underline" onClick={onRetry}>
                {intl.formatMessage({ id: 'project.materials.actions.retry' })}
              </button>
            ) : null}
          </span>
        ) : (
          <span className="truncate text-sm font-medium text-admin-neutral-800">
            {pending
              ? intl.formatMessage({ id: 'project.materials.states.loading' })
              : value || '—'}
          </span>
        )}
      </span>
    </div>
  );
}

function FactIcon({
  icon: Icon,
  tone,
}: {
  icon: LucideIcon;
  tone: 'primary' | 'muted';
}) {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        tone === 'primary'
          ? 'bg-admin-primary-bg text-admin-primary-dark'
          : 'bg-admin-neutral-bg text-admin-neutral-600',
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

function Fact({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <span className={className}>
      <span className="text-[11px] font-medium tracking-[0.04em] text-admin-neutral-500">
        {label}
      </span>
      <span className="truncate text-sm font-medium text-admin-neutral-800">
        {value}
      </span>
    </span>
  );
}
