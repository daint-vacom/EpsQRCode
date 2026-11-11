import { buildPath, ROUTES } from '@/constants/routes';
import {
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Clock3,
  Eye,
  Plus,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { CardLoading } from '@/components/ui/loading';
import { useMaterialSafetyInspectionsQuery } from '../hooks/use-safety-inspections';

export function MaterialSafetyInspectionsPanel({
  materialId,
  canManage,
  hasChecklist,
  requiresInspection,
}: {
  materialId: string;
  canManage: boolean;
  hasChecklist: boolean;
  requiresInspection: boolean;
}) {
  const intl = useIntl();
  const navigate = useNavigate();
  const query = useMaterialSafetyInspectionsQuery(materialId);
  const newInspectionPath = buildPath(
    ROUTES.PROJECT.MATERIAL_SAFETY_INSPECTION_CREATE,
    { id: materialId },
  );
  const materialPath = buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, {
    id: materialId,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CardTitle>
            {intl.formatMessage({
              id: 'project.materials.safetyInspection.history.title',
            })}
          </CardTitle>
          <CardDescription>
            {intl.formatMessage({
              id: 'project.materials.safetyInspection.history.description',
            })}
          </CardDescription>
        </div>
        {canManage ? (
          <Button
            type="button"
            size="md"
            disabled={!requiresInspection || !hasChecklist}
            onClick={() =>
              navigate(newInspectionPath, { state: { returnTo: materialPath } })
            }
          >
            <Plus />
            {intl.formatMessage({
              id: 'project.materials.safetyInspection.actions.create',
            })}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isPending ? (
          <CardLoading
            label={intl.formatMessage({ id: 'common.state.loading' })}
          />
        ) : query.isError ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'project.materials.safetyInspection.history.loadTitle',
            })}
            description={getApiErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : query.data.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title={intl.formatMessage({
              id: 'project.materials.safetyInspection.history.empty',
            })}
            className="min-h-36"
          />
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {query.data.map((inspection) => {
              const StatusIcon =
                inspection.status === 'in_progress'
                  ? Clock3
                  : inspection.overallResult === 'passed'
                    ? CircleCheck
                    : CircleX;
              const statusIconClassName =
                inspection.status === 'in_progress'
                  ? 'bg-[var(--color-warning-soft,var(--color-yellow-100))] text-[var(--color-warning-accent,var(--color-yellow-700))]'
                  : inspection.overallResult === 'passed'
                    ? 'bg-admin-success-bg text-admin-success-text'
                    : 'bg-destructive/10 text-destructive';
              const inspectedAt = new Intl.DateTimeFormat(intl.locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(inspection.inspectedAt));

              return (
                <div
                  key={inspection.id}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full',
                        statusIconClassName,
                      )}
                      aria-hidden="true"
                    >
                      <StatusIcon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {inspectedAt}
                        </span>
                        <Badge
                          variant={
                            inspection.status === 'in_progress'
                              ? 'warning'
                              : inspection.overallResult === 'passed'
                                ? 'success'
                                : 'destructive'
                          }
                          size="sm"
                        >
                          {intl.formatMessage({
                            id:
                              inspection.status === 'in_progress'
                                ? 'project.materials.safetyInspection.status.inProgress'
                                : `project.materials.safetyInspection.results.${inspection.overallResult}`,
                          })}
                        </Badge>
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {inspection.inspectorName} ·{' '}
                        {intl.formatMessage(
                          {
                            id: 'project.materials.safetyInspection.history.criteriaCount',
                          },
                          {
                            count: inspection.checklistResult.reduce(
                              (count, group) => count + group.criteria.length,
                              0,
                            ),
                          },
                        )}
                      </span>
                      {inspection.overallNote ? (
                        <span className="mt-1 block truncate text-sm text-muted-foreground">
                          {inspection.overallNote}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={intl.formatMessage(
                      {
                        id: 'project.materials.safetyInspection.history.open',
                      },
                      { date: inspectedAt },
                    )}
                    onClick={() =>
                      navigate(
                        buildPath(
                          ROUTES.PROJECT.MATERIAL_SAFETY_INSPECTION_DETAIL,
                          { id: materialId, inspectionId: inspection.id },
                        ),
                      )
                    }
                  >
                    <Eye />
                    {intl.formatMessage({
                      id: 'project.materials.safetyInspection.history.view',
                    })}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        {canManage && !requiresInspection ? (
          <p className="text-sm text-muted-foreground">
            {intl.formatMessage({
              id: 'project.materials.safetyInspection.errors.notRequired',
            })}
          </p>
        ) : null}
        {canManage && requiresInspection && !hasChecklist ? (
          <p className="text-sm text-muted-foreground">
            {intl.formatMessage({
              id: 'project.materials.safetyInspection.errors.noChecklist',
            })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
