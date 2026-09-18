import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Plus, UserRound } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDate, formatDateTime } from '@/lib/date';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  EntityDetailInformationCard,
  EntityDetailInformationGrid,
  EntityDetailInformationItem,
  EntityDetailProfileCard,
} from '@/components/layouts/entity-detail-layout';
import { loadWorkTree } from '../api/work.api';
import { WorkDetailLayout } from '../detail/work-detail-layout.generated';
import {
  WORK_PRIORITY_LABELS,
  WORK_STATUS_LABELS,
  workProgress,
} from '../model/work';

export function WorkDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { tenantId } = useTenant();
  const query = useQuery({
    queryKey: ['project', 'work', 'detail', tenantId, id],
    queryFn: () => loadWorkTree(tenantId!, id!),
    enabled: Boolean(tenantId && id),
  });
  const work = query.data?.root;
  const children = query.data?.children ?? [];

  if (query.isPending)
    return (
      <div className="p-5 text-sm text-muted-foreground">
        Đang tải công việc...
      </div>
    );
  if (query.isError || !work)
    return (
      <div className="flex h-full flex-col gap-4 p-5">
        <PageHeader
          title="Chi tiết công việc"
          icon={ClipboardList}
          onBack={() => navigate(-1)}
        />
        <Card className="p-8">
          <CardTitle>Không tìm thấy công việc</CardTitle>
          <CardDescription className="mt-2">
            {query.isError
              ? getApiErrorMessage(query.error)
              : 'Công việc có thể đã bị xóa hoặc bạn không có quyền truy cập.'}
          </CardDescription>
        </Card>
      </div>
    );

  const linkBadges = [
    ...work.customers.map((item) => `KH: ${item.label}`),
    ...work.contracts.map((item) => `HĐ: ${item.label}`),
  ];
  return (
    <WorkDetailLayout
      profile={
        <EntityDetailProfileCard
          avatar={
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardList className="size-8" />
            </div>
          }
          title={work.title}
          subtitle={work.code}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserRound className="size-4" />
            {work.assigneeName || 'Chưa giao'}
          </div>
          <Badge className="w-fit" variant="outline">
            {WORK_STATUS_LABELS[work.status]}
          </Badge>
        </EntityDetailProfileCard>
      }
      information={
        <EntityDetailInformationCard
          status={
            <Badge variant="outline">
              {WORK_PRIORITY_LABELS[work.priority]}
            </Badge>
          }
          actions={
            <>
              <Button variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft /> Quay lại
              </Button>
              <Button
                onClick={() =>
                  navigate(`/work?parent=${encodeURIComponent(work.id)}`)
                }
              >
                <Plus /> Thêm đầu mục con
              </Button>
            </>
          }
        >
          <EntityDetailInformationGrid>
            <EntityDetailInformationItem
              label="Bắt đầu dự kiến"
              value={
                work.plannedStartDate ? formatDate(work.plannedStartDate) : '—'
              }
            />
            <EntityDetailInformationItem
              label="Hoàn thành dự kiến"
              value={
                work.plannedEndDate ? formatDate(work.plannedEndDate) : '—'
              }
            />
            <EntityDetailInformationItem
              label="Bắt đầu thực tế"
              value={
                work.actualStartedAt
                  ? formatDateTime(work.actualStartedAt)
                  : '—'
              }
            />
            <EntityDetailInformationItem
              label="Hoàn thành thực tế"
              value={
                work.actualCompletedAt
                  ? formatDateTime(work.actualCompletedAt)
                  : '—'
              }
            />
            <EntityDetailInformationItem
              label="Tiến độ"
              value={`${workProgress(work)}%`}
            />
            <EntityDetailInformationItem
              label="Đầu mục con"
              value={`${work.completedChildCount}/${work.childCount}`}
            />
            <EntityDetailInformationItem
              label="Khách hàng"
              value={work.customers.length || '—'}
            />
            <EntityDetailInformationItem
              label="Hợp đồng"
              value={work.contracts.length || '—'}
            />
          </EntityDetailInformationGrid>
        </EntityDetailInformationCard>
      }
      overviewContent={
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Mô tả</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {work.description || 'Chưa có mô tả.'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Liên kết nghiệp vụ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {linkBadges.length ? (
                  linkBadges.map((label) => (
                    <Badge key={label} variant="secondary">
                      {label}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Không liên kết khách hàng hoặc hợp đồng.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      }
      childrenContent={
        <Card>
          <CardHeader>
            <CardTitle>Đầu mục con</CardTitle>
            <CardDescription>
              Các đầu mục có thể được giao cho nhân viên khác và theo dõi độc
              lập.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {children.length ? (
                children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => navigate(`/work/${child.id}`)}
                    className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:border-primary/50"
                  >
                    <span>
                      <span className="block font-medium">{child.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {child.assigneeName || 'Chưa giao'} ·{' '}
                        {child.plannedEndDate
                          ? formatDate(child.plannedEndDate)
                          : 'Chưa có hạn'}
                      </span>
                    </span>
                    <Badge variant="outline">
                      {WORK_STATUS_LABELS[child.status]}
                    </Badge>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Chưa có đầu mục con. Bạn có thể thêm từ màn hình quản lý công
                  việc bằng cách chọn công việc cha.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      }
    />
  );
}
