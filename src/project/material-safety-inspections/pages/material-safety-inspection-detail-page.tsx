import { useMemo } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useMaterialQuery } from '@/project/materials/hooks/use-materials';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import { ArrowDownToLine, Check, Save } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PROJECT_FEATURE_ICONS } from '@/config/project-feature-icons';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/loading';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { SafetyInspectionChecklistResultTable } from '../components/safety-inspection-checklist-display';
import {
  SAFETY_INSPECTION_DRAFT_FORM_ID,
  SafetyInspectionDraftForm,
} from '../components/safety-inspection-draft-form';
import {
  useSafetyInspectionQuery,
  useSaveMaterialSafetyInspectionMutation,
} from '../hooks/use-safety-inspections';

export function MaterialSafetyInspectionDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const { id = '', inspectionId = '' } = useParams();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const materialQuery = useMaterialQuery(id, !isPermissionsPending && canView);
  const inspectionQuery = useSafetyInspectionQuery(
    inspectionId,
    !isPermissionsPending && canView,
  );
  const saveMutation = useSaveMaterialSafetyInspectionMutation();
  const material = materialQuery.data;
  const inspection = inspectionQuery.data;
  const materialPath = buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, { id });
  const returnTo =
    typeof location.state === 'object' &&
    location.state !== null &&
    'returnTo' in location.state &&
    typeof location.state.returnTo === 'string'
      ? location.state.returnTo
      : materialPath;
  const canEditInspection = Boolean(
    canManage &&
    material &&
    inspection?.status === 'in_progress' &&
    inspection.materialId === material.id,
  );
  const title = intl.formatMessage({
    id: 'project.materials.safetyInspection.page.detailTitle',
  });
  const header = useMemo(
    () => ({
      title,
      icon: PROJECT_FEATURE_ICONS.safetyInspections,
      showBackButton: true,
      backLabel: intl.formatMessage({
        id: 'project.materials.safetyInspection.actions.back',
      }),
      onBack: () => navigate(returnTo),
      actions: canEditInspection ? (
        <>
          <Button
            type="submit"
            form={SAFETY_INSPECTION_DRAFT_FORM_ID}
            name="inspectionAction"
            value="draft"
            variant="outline"
            size="md"
            loading={saveMutation.isPending}
            loadingText={intl.formatMessage({
              id: 'common.state.saving',
            })}
            disabled={saveMutation.isPending}
          >
            <Save aria-hidden="true" />
            {intl.formatMessage({
              id: 'project.materials.safetyInspection.actions.saveDraft',
            })}
          </Button>
          <Button
            type="submit"
            form={SAFETY_INSPECTION_DRAFT_FORM_ID}
            name="inspectionAction"
            value="complete"
            variant="success"
            size="md"
            loading={saveMutation.isPending}
            loadingText={intl.formatMessage({
              id: 'common.state.saving',
            })}
            disabled={saveMutation.isPending}
          >
            <Check aria-hidden="true" />
            {intl.formatMessage({
              id: 'project.materials.safetyInspection.actions.complete',
            })}
          </Button>
        </>
      ) : undefined,
    }),
    [
      canEditInspection,
      intl,
      navigate,
      returnTo,
      saveMutation.isPending,
      title,
    ],
  );
  useDetailEntryLayoutHeader(header);

  const isLoading =
    isPermissionsPending ||
    (canView && (materialQuery.isPending || inspectionQuery.isPending));

  return (
    <div className="flex min-w-0 flex-col gap-4 p-4 lg:p-5">
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
          title={title}
          description={intl.formatMessage({
            id: 'project.materials.safetyInspection.errors.notFound',
          })}
        />
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <Card>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DetailValue
                label={intl.formatMessage({
                  id: 'project.materials.safetyInspection.fields.material',
                })}
                value={`${material.code} · ${material.nameOverride || material.modelSnapshot.name}`}
              />
              <DetailValue
                label={intl.formatMessage({
                  id: 'project.materials.safetyInspection.type',
                })}
                value={inspection.inspectionTypeName}
              />
              <DetailValue
                label={intl.formatMessage({
                  id: 'project.materials.safetyInspection.fields.inspectedAt',
                })}
                value={new Intl.DateTimeFormat(intl.locale, {
                  dateStyle: 'long',
                  timeStyle: 'short',
                }).format(new Date(inspection.inspectedAt))}
              />
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
                    inspection.status === 'in_progress'
                      ? 'warning'
                      : inspection.overallResult === 'passed'
                        ? 'success'
                        : 'destructive'
                  }
                >
                  {intl.formatMessage({
                    id:
                      inspection.status === 'in_progress'
                        ? 'project.materials.safetyInspection.status.inProgress'
                        : `project.materials.safetyInspection.results.${inspection.overallResult}`,
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

          {inspection.status === 'in_progress' && canManage ? (
            <SafetyInspectionDraftForm
              inspection={inspection}
              isSaving={saveMutation.isPending}
              onSave={async (values, attachments, files, complete) => {
                try {
                  await saveMutation.mutateAsync({
                    inspectionId: inspection.id,
                    materialId: material.id,
                    values,
                    attachments,
                    files,
                    complete,
                  });
                  toast.success(
                    intl.formatMessage({
                      id: complete
                        ? 'project.materials.safetyInspection.toasts.completed'
                        : 'project.materials.safetyInspection.toasts.draftSaved',
                    }),
                  );
                  if (complete) await inspectionQuery.refetch();
                  return true;
                } catch (error) {
                  toast.error(getApiErrorMessage(error));
                  return false;
                }
              }}
            />
          ) : (
            <>
              <Card>
                <CardContent>
                  <SafetyInspectionChecklistResultTable
                    groups={inspection.checklistResult}
                  />
                </CardContent>
              </Card>

              {inspection.attachments.length > 0 ? (
                <Card>
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
            </>
          )}
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
