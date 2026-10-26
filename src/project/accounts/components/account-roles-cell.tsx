import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import type { AccountRole } from '../model/account';

export function AccountRolesCell({ roles }: { roles: AccountRole[] }) {
  const intl = useIntl();

  if (roles.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">
        {intl.formatMessage({ id: 'accounts.roles.empty' })}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {roles.map((role) => (
        <Badge
          key={role.name}
          variant={role.color}
          appearance="light"
          className="max-w-full justify-start rounded-md px-2.5 py-1 text-xs"
        >
          <span className="min-w-0 truncate">{role.name}</span>
        </Badge>
      ))}
    </div>
  );
}
