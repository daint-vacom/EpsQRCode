import { useEffect, useMemo, useRef } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { useMaterialQuery } from '@/project/materials/hooks/use-materials';
import {
  getMaterialInspectionSettings,
  getMaterialSafetyInspectionChecklist,
} from '@/project/materials/model/material';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import { ClipboardPenLine } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/loading';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { useStartMaterialSafetyInspectionMutation } from '../hooks/use-safety-inspections';

export function MaterialSafetyInspectionCreatePage() {
  const intl = useIntl();
  const location = useLocation();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { user, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const materialQuery = useMaterialQuery(id, !isPermissionsPending && canView);
  const material = materialQuery.data;
  const checklist = useMemo(
    () =>
      material ? getMaterialSafetyInspectionChecklist(material) : undefined,
    [material],
  );
  const startMutation = useStartMaterialSafetyInspectionMutation();
  const startedMaterialId = useRef<string | null>(null);
  const materialPath = buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, { id });
  const title = intl.formatMessage({
    id: 'project.materials.safetyInspection.page.createTitle',
  });

  useEffect(() => {
    if (
      !material ||
      materialQuery.isFetching ||
      !canManage ||
      startMutation.isPending ||
      !getMaterialInspectionSettings(material).requiresInspection ||
      !checklist?.length ||
      startedMaterialId.current === material.id
    ) {
      return;
    }
    startedMaterialId.current = material.id;
    startMutation.mutate(
      {
        materialId: material.id,
        checklist,
        inspectorName: user?.name ?? '',
        inspectedAt: new Date().toISOString(),
      },
      {
        onSuccess: (inspectionId) =>
          navigate(
            buildPath(ROUTES.PROJECT.MATERIAL_SAFETY_INSPECTION_DETAIL, {
              id: material.id,
              inspectionId,
            }),
            { replace: true, state: location.state },
          ),
      },
    );
  }, [
    canManage,
    checklist,
    location.state,
    material,
    materialQuery.isFetching,
    navigate,
    startMutation,
    user?.name,
  ]);

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
    (canView && (materialQuery.isPending || materialQuery.isFetching)) ||
    startMutation.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:p-5">
      {!isPermissionsPending && (!canView || !canManage) ? (
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
      ) : materialQuery.isError ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.errors.loadDetailTitle',
          })}
          description={getApiErrorMessage(materialQuery.error)}
          onRetry={() => void materialQuery.refetch()}
        />
      ) : startMutation.isError ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.safetyInspection.errors.startTitle',
          })}
          description={getApiErrorMessage(startMutation.error)}
          onRetry={() => {
            startedMaterialId.current = null;
            startMutation.reset();
          }}
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
      ) : !getMaterialInspectionSettings(material).requiresInspection ? (
        <ErrorState
          title={title}
          description={intl.formatMessage({
            id: 'project.materials.safetyInspection.errors.notRequired',
          })}
        />
      ) : !checklist?.length ? (
        <ErrorState
          title={title}
          description={intl.formatMessage({
            id: 'project.materials.safetyInspection.errors.noChecklist',
          })}
          onRetry={() =>
            navigate(buildPath(ROUTES.PROJECT.MATERIAL_EDIT, { id }))
          }
        />
      ) : (
        <PageLoading
          label={intl.formatMessage({ id: 'common.state.loading' })}
        />
      )}
    </div>
  );
}
