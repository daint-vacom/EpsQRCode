import { useAuthStore } from '@/stores/auth.store';
import { useIntl } from 'react-intl';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { PageLoading } from '@/components/ui/loading';
import { MATERIAL_PERMISSION_CODES } from '../model/material-permissions';
import { MaterialDetailPage } from './material-detail-page';

export function MaterialPublicAccessPage() {
  const intl = useIntl();
  const token = useAuthStore((state) => state.token);
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const isAuthenticated = Boolean(token);
  const canViewFullDetails = hasPermission(MATERIAL_PERMISSION_CODES.view);

  if (isAuthenticated && isPermissionsPending) {
    return (
      <PageLoading label={intl.formatMessage({ id: 'common.state.loading' })} />
    );
  }

  return (
    <MaterialDetailPage publicMode={!isAuthenticated || !canViewFullDetails} />
  );
}
