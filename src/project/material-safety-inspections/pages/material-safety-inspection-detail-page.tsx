import { useMemo } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useMaterialQuery } from '@/project/materials/hooks/use-materials';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import { ArrowDownToLine, ClipboardPenLine } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';
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
  CardTitle,
} from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/loading';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { useSafetyInspectionQuery } from '../hooks/use-safety-inspections';

export function MaterialSafetyInspectionDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id = '', inspectionId = '' } = useParams();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const materialQuery = useMaterialQuery(id, !isPermissionsPending && canView);
  const inspectionQuery = useSafetyInspectionQuery(
    inspectionId,
    !isPermissionsPending && canView,
  );
  const material = materialQuery.data;
  const inspection = inspectionQuery.data;
  const materialPath = buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, { id });
  const title = intl.formatMessage({
    id: 'project.materials.safetyInspection.page.detailTitle',
  });
  const header = useMemo(
    () => ({
      title,
      icon: ClipboardPenLine,
      showBackButton: true,
      backLabel: intl.formatMessage({
        id: 'project.materials.safetyInspection.actions.back',
      }),
      onBack: () => navigate(materialPath),
    }),
    [intl, materialPath, navigate, title],
  );
  useDetailEntryLayoutHeader(header);

  const isLoading =
    isPermissionsPending ||
    (canView && (materialQuery.isPending || inspectionQuery.isPending));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:p-5">
      {!isPermissionsPending && !canView ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.errors.authorizationTitle',
          })}
          description={intl.formatMessage({
            id: 'project.materials.errors.authorization',
          })}
        />
      ) : isLoading ? (
        <PageLoading
          label={intl.formatMessage({ id: 'common.state.loading' })}
        />
      ) : materialQuery.isError || inspectionQuery.isError ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.safetyInspection.history.loadTitle',
          })}
          description={getApiErrorMessage(
            materialQuery.error ?? inspectionQuery.error,
          )}
          onRetry={() => {
            void materialQuery.refetch();
            void inspectionQuery.refetch();
          }}
        />
      ) : !material || !inspection || inspection.materialId !== material.id ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.safetyInspection.page.detailTitle',
          })}
          description={intl.formatMessage({
            id: 'project.materials.safetyInspection.errors.notFound',
          })}
        />
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {material.code} ·{' '}
              {material.nameOverride || material.modelSnapshot.name}
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>
                {intl.formatMessage({
                  id: 'project.materials.safetyInspection.sections.information',
                })}
              </CardTitle>
              <CardDescription>
                {new Intl.DateTimeFormat(intl.locale, {
                  dateStyle: 'long',
                  timeStyle: 'short',
                }).format(new Date(inspection.inspectedAt))}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DetailValue
                label={intl.formatMessage({
                  id: 'project.materials.safetyInspection.fields.inspector',
                })}
                value={inspection.inspectorName}
              />
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {intl.formatMessage({
                    id: 'project.materials.safetyInspection.fields.result',
                  })}
                </p>
                <Badge
                  variant={
                    inspection.overallResult === 'passed'
                      ? 'success'
                      : 'destructive'
                  }
                >
                  {intl.formatMessage({
                    id: `project.materials.safetyInspection.results.${inspection.overallResult}`,
                  })}
                </Badge>
              </div>
              {inspection.overallNote ? (
                <DetailValue
                  label={intl.formatMessage({
                    id: 'project.materials.safetyInspection.fields.note',
                  })}
                  value={inspection.overallNote}
                  className="sm:col-span-2"
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {intl.formatMessage({
                  id: 'project.materials.safetyInspection.sections.checklist',
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {inspection.checklistResult.map((group) => (
                <section key={group.id} className="space-y-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {group.name}
                  </h2>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {group.criteria.map((criterion) => (
                      <div
                        key={criterion.id}
                        className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <p className="text-sm text-foreground">
                          {criterion.content}
                        </p>
                        <Badge
                          variant={criterion.passed ? 'success' : 'destructive'}
                          size="sm"
                        >
                          {intl.formatMessage({
                            id: criterion.passed
                              ? 'project.materials.safetyInspection.results.passed'
                              : 'project.materials.safetyInspection.results.failed',
                          })}
                        </Badge>
                        {criterion.note ? (
                          <p className="text-sm text-muted-foreground md:col-span-2">
                            {criterion.note}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </CardContent>
          </Card>

          {inspection.attachments.length ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {intl.formatMessage({
                    id: 'project.handover.fields.attachments',
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border rounded-lg border border-border p-0">
                {inspection.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {attachment.fileName}
                    </span>
                    {attachment.url ? (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ArrowDownToLine />
                          {intl.formatMessage({
                            id: 'project.materials.safetyInspection.attachments.download',
                          })}
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.attachments.unavailable',
                        })}
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

function DetailValue({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
