import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import { useIntl } from 'react-intl';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { PROJECT_FEATURE_ICONS } from '@/config/project-feature-icons';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/loading';
import { OptionSelect } from '@/components/ui/option-select';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import {
  useMaterialSafetyInspectionTypesQuery,
  useStartMaterialSafetyInspectionMutation,
} from '../hooks/use-safety-inspections';
import { canStartMaterialSafetyInspection } from '../model/safety-inspection';

export function MaterialSafetyInspectionCreatePage() {
  const intl = useIntl();
  const location = useLocation();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const requestedTypeId = searchParams.get('inspectionTypeId');
  const { user, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canStart =
    hasPermission(MATERIAL_PERMISSION_CODES.view) &&
    hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const typesQuery = useMaterialSafetyInspectionTypesQuery(
    id,
    !isPermissionsPending && canStart,
  );
  const types = typesQuery.data?.filter(canStartMaterialSafetyInspection);
  const [selectedType, setSelectedType] = useState<{
    materialId: string;
    typeId: string;
  }>();
  const selectedTypeId =
    selectedType?.materialId === id ? selectedType.typeId : '';
  const automaticTypeId = requestedTypeId
    ? types?.find((type) => type.typeId === requestedTypeId)?.typeId
    : types?.length === 1
      ? types[0].typeId
      : undefined;
  const { mutate, isPending, isError, reset, error } =
    useStartMaterialSafetyInspectionMutation();
  const attemptedKey = useRef('');
  const materialPath = buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, { id });
  const returnTo =
    typeof location.state?.returnTo === 'string'
      ? location.state.returnTo
      : materialPath;
  const title = intl.formatMessage({
    id: 'project.materials.safetyInspection.page.createTitle',
  });
  const typeLabel = intl.formatMessage({
    id: 'project.materials.safetyInspection.type',
  });

  const start = useCallback(
    (typeId: string) => {
      mutate(
        {
          materialId: id,
          inspectionTypeId: typeId,
          inspectorName: user?.name ?? '',
          inspectedAt: new Date().toISOString(),
        },
        {
          onSuccess: (inspectionId) =>
            navigate(
              buildPath(ROUTES.PROJECT.MATERIAL_SAFETY_INSPECTION_DETAIL, {
                id,
                inspectionId,
              }),
              { replace: true, state: location.state },
            ),
        },
      );
    },
    [id, location.state, mutate, navigate, user?.name],
  );

  useEffect(() => {
    if (
      !canStart ||
      !automaticTypeId ||
      typesQuery.isFetching ||
      isPending ||
      isError
    ) {
      return;
    }
    const key = id + ':' + automaticTypeId;
    if (attemptedKey.current === key) return;
    attemptedKey.current = key;
    start(automaticTypeId);
  }, [
    automaticTypeId,
    canStart,
    id,
    isError,
    isPending,
    start,
    typesQuery.isFetching,
  ]);

  const header = useMemo(
    () => ({
      title,
      icon: PROJECT_FEATURE_ICONS.safetyInspections,
      showBackButton: true,
      backLabel: intl.formatMessage({
        id: 'project.materials.safetyInspection.actions.back',
      }),
      onBack: () => navigate(returnTo),
    }),
    [intl, navigate, returnTo, title],
  );
  useDetailEntryLayoutHeader(header);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:p-5">
      {!isPermissionsPending && !canStart ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.errors.authorizationTitle',
          })}
          description={intl.formatMessage({
            id: 'project.materials.errors.authorization',
          })}
        />
      ) : isPermissionsPending || typesQuery.isPending || isPending ? (
        <PageLoading
          label={intl.formatMessage({ id: 'common.state.loading' })}
        />
      ) : typesQuery.isError ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.errors.loadDetailTitle',
          })}
          description={getApiErrorMessage(typesQuery.error)}
          onRetry={() => void typesQuery.refetch()}
        />
      ) : isError ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.safetyInspection.errors.startTitle',
          })}
          description={getApiErrorMessage(error)}
          onRetry={() => {
            attemptedKey.current = '';
            reset();
          }}
        />
      ) : !types?.length || (requestedTypeId && !automaticTypeId) ? (
        <ErrorState
          title={title}
          description={intl.formatMessage({
            id: 'project.materials.safetyInspection.errors.typeUnavailable',
          })}
          onRetry={() => void typesQuery.refetch()}
        />
      ) : automaticTypeId ? (
        <PageLoading
          label={intl.formatMessage({ id: 'common.state.loading' })}
        />
      ) : (
        <Card>
          <CardContent>
            <form
              className="flex flex-wrap items-center gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (types.some((type) => type.typeId === selectedTypeId)) {
                  start(selectedTypeId);
                }
              }}
            >
              <span>{typeLabel}</span>
              <OptionSelect
                ariaLabel={typeLabel}
                value={selectedTypeId}
                onChange={(typeId) =>
                  setSelectedType({ materialId: id, typeId })
                }
                options={types.map((type) => ({
                  value: type.typeId,
                  label: type.typeName,
                }))}
              />
              <Button
                type="submit"
                disabled={!types.some((type) => type.typeId === selectedTypeId)}
              >
                {intl.formatMessage({
                  id: 'project.materials.safetyInspection.actions.create',
                })}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
