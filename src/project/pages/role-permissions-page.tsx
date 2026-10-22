import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  User,
  type LucideIcon,
} from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { toast } from 'sonner';
import { queryClient } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { useUser } from '@/providers/user-provider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/loading';
import { OptionSelect } from '@/components/ui/option-select';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  createRole,
  deleteRole,
  loadRolePermissionsWorkspace,
  replaceRolePermissions,
  updateRole,
} from '../api/role-permissions.api';
import { RoleFormDialog, useRoleForm } from '../forms/role-form.generated';
import {
  countPermissions,
  getTagSummary,
  PERMISSION_TAGS,
  ROLE_COLOR_SWATCH_CLASSES,
  type PermissionItem,
  type PermissionModule,
  type PermissionScope,
  type PermissionTag,
  type RoleFormValues,
  type RoleSummary,
  type SummaryState,
} from '../model/role-permission';

const EMPTY_PERMISSION_MODULES: PermissionModule[] = [];

const tagMeta: Record<
  PermissionTag,
  {
    icon: LucideIcon;
    messageId: string;
    className: string;
    mutedClassName: string;
  }
> = {
  Xem: {
    icon: Eye,
    messageId: 'permissions.tags.view',
    className:
      'border-admin-blue-border bg-secondary text-secondary-foreground',
    mutedClassName: 'text-secondary-foreground/50',
  },
  'Chỉnh sửa': {
    icon: Pencil,
    messageId: 'permissions.tags.edit',
    className:
      'border-admin-success-bg bg-admin-success-bg text-admin-success-text',
    mutedClassName: 'text-admin-success-text/50',
  },
  Xóa: {
    icon: Trash2,
    messageId: 'permissions.tags.delete',
    className: 'border-admin-red-bg bg-admin-red-bg text-admin-red-primary',
    mutedClassName: 'text-admin-red-primary/50',
  },
  Duyệt: {
    icon: CheckCircle2,
    messageId: 'permissions.tags.approve',
    className:
      'border-admin-amber-border bg-admin-amber-bg text-admin-amber-dark',
    mutedClassName: 'text-admin-amber-dark/50',
  },
};

function flattenSelected(modules: PermissionModule[]) {
  return modules
    .flatMap((module) =>
      module.groups.flatMap((group) =>
        group.permissions.map((permission) => ({
          code: permission.code,
          selected: permission.selected,
          scope: permission.selected ? permission.scope : null,
        })),
      ),
    )
    .sort((a, b) => a.code.localeCompare(b.code));
}

function countChanges(
  modules: PermissionModule[],
  savedModules: PermissionModule[],
) {
  const current = flattenSelected(modules);
  const saved = flattenSelected(savedModules);

  return current.filter(
    (item, index) =>
      item.code !== saved[index]?.code ||
      item.selected !== saved[index]?.selected ||
      item.scope !== saved[index]?.scope,
  ).length;
}

function countAllPermissions(modules: PermissionModule[]) {
  return modules.reduce(
    (sum, module) => sum + countPermissions(module).total,
    0,
  );
}

export function RolePermissionsPage() {
  const intl = useIntl();
  const { userId } = useUser();
  const workspaceQuery = useQuery({
    queryKey: ['project', 'role-permissions', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error(
          intl.formatMessage({
            id: 'common.errors.dataNotReady',
          }),
        );
      }
      return loadRolePermissionsWorkspace();
    },
    enabled: Boolean(userId),
  });
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [modules, setModules] = useState<PermissionModule[]>([]);
  const [expandedModules, setExpandedModules] = useState<string[]>([
    'material_catalog',
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRole, setDialogRole] = useState<RoleSummary | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleSummary | null>(null);
  const roleForm = useRoleForm();

  const roles = workspaceQuery.data?.roles ?? [];
  const activeRoleId = selectedRoleId || roles[0]?.id || '';
  const selectedRole = roles.find((role) => role.id === activeRoleId);
  const selectedRoleIsSystem = Boolean(selectedRole?.isSystem);
  const modulesByRoleId = workspaceQuery.data?.modulesByRoleId;
  const savedModules = useMemo(
    () =>
      activeRoleId
        ? (modulesByRoleId?.[activeRoleId] ?? EMPTY_PERMISSION_MODULES)
        : EMPTY_PERMISSION_MODULES,
    [activeRoleId, modulesByRoleId],
  );

  const openRoleDialog = (role: RoleSummary) => {
    setDialogRole(role);
    roleForm.reset({
      code: role.code ?? '',
      name: role.name,
      color: role.color,
      description: role.description,
    });
    setDialogOpen(true);
  };

  const openCreateRole = () => {
    openRoleDialog({
      id: '',
      code: '',
      name: '',
      color: 'blue',
      description: '',
      userCount: 0,
    });
  };

  useEffect(() => {
    if (!activeRoleId) {
      setModules((current) =>
        current.length === 0 ? current : EMPTY_PERMISSION_MODULES,
      );
      return;
    }

    setSelectedRoleId((current) => current || activeRoleId);
    setModules(structuredClone(savedModules));
  }, [activeRoleId, savedModules]);

  const changeCount = useMemo(
    () => countChanges(modules, savedModules),
    [modules, savedModules],
  );
  const hasUnsavedChanges = changeCount > 0;
  const confirmLeave = useCallback(
    (message: string) => !hasUnsavedChanges || window.confirm(message),
    [hasUnsavedChanges],
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const handleInternalNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;

      const target = event.target as Element | null;
      const link = target?.closest('a[href]');
      if (
        !link ||
        link.getAttribute('target') === '_blank' ||
        link.hasAttribute('download') ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href === window.location.pathname) {
        return;
      }

      if (
        !confirmLeave(
          intl.formatMessage({
            id: 'permissions.roles.leaveWithUnsavedChanges',
          }),
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleInternalNavigation, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleInternalNavigation, true);
    };
  }, [confirmLeave, hasUnsavedChanges, intl]);

  const totalPermissions = useMemo(
    () => countAllPermissions(modules),
    [modules],
  );
  const selectedPermissions = useMemo(
    () =>
      modules.reduce(
        (sum, module) => sum + countPermissions(module).selected,
        0,
      ),
    [modules],
  );

  const handleToggleModule = (code: string) => {
    setExpandedModules((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  };

  const handleTogglePermission = (code: string, checked: boolean) => {
    if (selectedRoleIsSystem) return;

    setModules((current) =>
      current.map((module) => ({
        ...module,
        groups: module.groups.map((group) => ({
          ...group,
          permissions: group.permissions.map((permission) =>
            permission.code === code
              ? { ...permission, selected: checked }
              : permission,
          ),
        })),
      })),
    );
  };

  const handlePermissionScope = (
    code: string,
    scope: PermissionScope | null,
  ) => {
    if (selectedRoleIsSystem) return;

    setModules((current) =>
      current.map((module) => ({
        ...module,
        groups: module.groups.map((group) => ({
          ...group,
          permissions: group.permissions.map((permission) =>
            permission.code === code
              ? { ...permission, scope, selected: scope !== null }
              : permission,
          ),
        })),
      })),
    );
  };

  const handleReset = () => {
    setModules(structuredClone(savedModules));
  };

  const savePermissionsMutation = useMutation({
    mutationFn: () => {
      if (selectedRoleIsSystem) {
        throw new Error(
          intl.formatMessage({ id: 'permissions.roles.errors.systemManaged' }),
        );
      }

      return replaceRolePermissions(
        activeRoleId,
        modules.flatMap((module) =>
          module.groups.flatMap((group) =>
            group.permissions
              .filter((permission) => permission.selected)
              .map((permission) => ({
                code: permission.code,
                scope: permission.scope,
              })),
          ),
        ),
      );
    },
    onSuccess: async () => {
      toast.success(
        intl.formatMessage({ id: 'permissions.roles.toasts.permissionsSaved' }),
      );
      await queryClient.invalidateQueries({
        queryKey: ['project', 'role-permissions', userId],
      });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : intl.formatMessage({
              id: 'permissions.roles.toasts.permissionsSaveError',
            }),
      ),
  });

  const saveRoleMutation = useMutation({
    mutationFn: async ({
      role,
      values,
    }: {
      role: RoleSummary;
      values: RoleFormValues;
    }) => {
      if (!workspaceQuery.data) {
        throw new Error(
          intl.formatMessage({ id: 'permissions.roles.errors.dataNotReady' }),
        );
      }

      if (role.id) {
        return updateRole(role.id, {
          name: values.name.trim(),
          description: values.description.trim() || null,
          color: values.color,
        });
      }

      const code = values.code.trim().toLowerCase();
      if (!code) {
        throw new Error(
          intl.formatMessage({ id: 'permissions.roles.errors.codeRequired' }),
        );
      }

      return createRole({
        code,
        name: values.name.trim(),
        color: values.color,
        description: values.description.trim() || null,
      });
    },
    onSuccess: async (role) => {
      toast.success(
        intl.formatMessage({ id: 'permissions.roles.toasts.saved' }),
      );
      setDialogOpen(false);
      if (role.id) setSelectedRoleId(role.id);
      await queryClient.invalidateQueries({
        queryKey: ['project', 'role-permissions', userId],
      });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : intl.formatMessage({ id: 'permissions.roles.toasts.saveError' }),
      ),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (role: RoleSummary) => deleteRole(role.id),
    onSuccess: async () => {
      toast.success(
        intl.formatMessage({ id: 'permissions.roles.toasts.deleted' }),
      );
      setDeletingRole(null);
      setSelectedRoleId('');
      await queryClient.invalidateQueries({
        queryKey: ['project', 'role-permissions', userId],
      });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : intl.formatMessage({ id: 'permissions.roles.toasts.deleteError' }),
      ),
  });

  const handleSaveRole = (values: RoleFormValues) => {
    if (!dialogRole) return;
    saveRoleMutation.mutate({ role: dialogRole, values });
  };

  const pageHeader = (
    <PageHeader
      title={intl.formatMessage({ id: 'permissions.page.title' })}
      icon={ShieldCheck}
      className="shrink-0"
    />
  );

  if (!userId) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-auto p-4 lg:p-5">
        {pageHeader}
        <ErrorState
          className="flex-1"
          title={intl.formatMessage({ id: 'permissions.page.loadError' })}
          description={intl.formatMessage({ id: 'common.errors.dataNotReady' })}
        />
      </div>
    );
  }

  if (workspaceQuery.isPending) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-auto p-4 lg:p-5">
        {pageHeader}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <PageLoading
            label={intl.formatMessage({ id: 'permissions.page.loading' })}
          />
        </div>
      </div>
    );
  }

  if (workspaceQuery.isError) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-auto p-4 lg:p-5">
        {pageHeader}
        <ErrorState
          className="flex-1"
          title={intl.formatMessage({ id: 'permissions.page.loadError' })}
          description={
            workspaceQuery.error instanceof Error
              ? workspaceQuery.error.message
              : undefined
          }
          onRetry={() => void workspaceQuery.refetch()}
        />
      </div>
    );
  }

  if (!selectedRole) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-admin-page-section overflow-auto p-4 text-sm text-muted-foreground lg:p-5">
        {pageHeader}
        <div className="flex flex-1 items-center justify-center">
          {intl.formatMessage({ id: 'permissions.page.empty' })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full max-w-full min-w-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:overflow-hidden xl:p-5">
      {pageHeader}
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-admin-page-section xl:flex-row xl:overflow-hidden">
        <Card className="max-h-[220px] w-full max-w-full shrink-0 overflow-hidden xl:max-h-none xl:w-[260px]">
          <CardHeader className="min-h-0 flex-col items-start gap-1 p-4">
            <div className="flex w-full items-center justify-between gap-2">
              <CardTitle className="text-[15px]">
                {intl.formatMessage({ id: 'permissions.roles.listTitle' })}
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    mode="icon"
                    size="sm"
                    aria-label={intl.formatMessage({
                      id: 'permissions.roles.add',
                    })}
                    onClick={openCreateRole}
                  >
                    <Plus className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent variant="light">
                  {intl.formatMessage({ id: 'permissions.roles.add' })}
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-auto p-3 xl:flex xl:flex-col">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                  role.id === activeRoleId
                    ? 'border-primary bg-primary/8 text-foreground'
                    : 'border-border bg-background hover:bg-field',
                )}
                onClick={() => {
                  if (
                    role.id === activeRoleId ||
                    confirmLeave(
                      intl.formatMessage({
                        id: 'permissions.roles.switchWithUnsavedChanges',
                      }),
                    )
                  ) {
                    setSelectedRoleId(role.id);
                  }
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2.5 shrink-0 rounded-full border',
                      ROLE_COLOR_SWATCH_CLASSES[role.color],
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">
                      {role.name}
                    </span>
                  </span>
                </span>
                <Badge
                  variant="secondary"
                  appearance="light"
                  size="sm"
                  className="gap-1"
                >
                  <User />
                  {role.userCount}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="min-h-0 w-full max-w-full min-w-0 flex-1 overflow-hidden">
          <CardHeader className="shrink-0 flex-col items-stretch gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
            <CardHeading>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-[18px]">
                  {intl.formatMessage(
                    { id: 'permissions.roles.permissionHeading' },
                    { role: selectedRole.name },
                  )}
                </CardTitle>
                <Badge variant="primary" appearance="light" size="sm">
                  {intl.formatMessage(
                    { id: 'permissions.roles.permissionCount' },
                    { selected: selectedPermissions, total: totalPermissions },
                  )}
                </Badge>
              </div>
            </CardHeading>
            <CardToolbar>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={selectedRoleIsSystem}
                  title={
                    selectedRoleIsSystem
                      ? intl.formatMessage({
                          id: 'permissions.roles.systemEditDisabled',
                        })
                      : intl.formatMessage({ id: 'permissions.roles.edit' })
                  }
                  onClick={() => openRoleDialog(selectedRole)}
                >
                  <Pencil />
                  {intl.formatMessage({ id: 'permissions.roles.edit' })}
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                  disabled={
                    Boolean(selectedRole.isSystem) ||
                    selectedRole.userCount > 0 ||
                    deleteRoleMutation.isPending
                  }
                  title={
                    selectedRole.isSystem
                      ? intl.formatMessage({
                          id: 'permissions.roles.systemDeleteDisabled',
                        })
                      : selectedRole.userCount > 0
                        ? intl.formatMessage({
                            id: 'permissions.roles.assignedDeleteDisabled',
                          })
                        : intl.formatMessage({ id: 'permissions.roles.delete' })
                  }
                  onClick={() => setDeletingRole(selectedRole)}
                >
                  <Trash2 />
                  {intl.formatMessage({ id: 'permissions.roles.delete' })}
                </Button>
              </div>
            </CardToolbar>
          </CardHeader>

          {selectedRoleIsSystem ? (
            <div className="mx-5 mb-4 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
              {intl.formatMessage({ id: 'permissions.roles.systemNotice' })}
            </div>
          ) : null}

          <CardContent className="min-h-0 min-w-0 overflow-hidden p-0">
            <ScrollArea className="h-full w-full max-w-full min-w-0">
              <div className="min-w-[752px]">
                <div className="sticky top-0 z-10 grid grid-cols-[minmax(240px,1fr)_repeat(4,128px)] border-b bg-muted text-[12px] font-semibold text-secondary-foreground">
                  <div className="border-r px-5 py-3">
                    {intl.formatMessage({ id: 'permissions.table.module' })}
                  </div>
                  {PERMISSION_TAGS.map((tag) => (
                    <div key={tag} className="border-r px-3 py-3 text-center">
                      <TagHeader tag={tag} />
                    </div>
                  ))}
                </div>

                {modules.map((module) => (
                  <ModulePermissionSection
                    key={module.code}
                    expanded={expandedModules.includes(module.code)}
                    module={module}
                    disabled={selectedRoleIsSystem}
                    onToggle={() => handleToggleModule(module.code)}
                    onTogglePermission={handleTogglePermission}
                    onPermissionScopeChange={handlePermissionScope}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>

          <CardFooter className="shrink-0 justify-between gap-3 bg-background">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {changeCount > 0 ? (
                <>
                  <AlertTriangle className="size-4 text-admin-amber-dark" />
                  <span>
                    {intl.formatMessage(
                      { id: 'permissions.roles.changes.unsaved' },
                      { count: changeCount },
                    )}
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4 text-admin-success-text" />
                  <span>
                    {intl.formatMessage({
                      id: 'permissions.roles.changes.none',
                    })}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={changeCount === 0 || selectedRoleIsSystem}
                onClick={handleReset}
              >
                <RotateCcw />
                {intl.formatMessage({ id: 'permissions.roles.reset' })}
              </Button>
              <Button
                variant="primary"
                disabled={changeCount === 0 || selectedRoleIsSystem}
                loading={savePermissionsMutation.isPending}
                loadingText={intl.formatMessage({
                  id: 'permissions.roles.saveLoading',
                })}
                onClick={() => savePermissionsMutation.mutate()}
              >
                <Save />
                {intl.formatMessage({ id: 'permissions.roles.saveChanges' })}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>

      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={roleForm}
        onSubmit={handleSaveRole}
        title={intl.formatMessage({
          id: dialogRole?.id
            ? 'permissions.roles.dialog.editTitle'
            : 'permissions.roles.dialog.createTitle',
        })}
        isCreating={!dialogRole?.id}
        isSaving={saveRoleMutation.isPending}
      />

      <RoleDeleteDialog
        role={deletingRole}
        isDeleting={deleteRoleMutation.isPending}
        onClose={() => setDeletingRole(null)}
        onConfirm={() => {
          if (deletingRole) deleteRoleMutation.mutate(deletingRole);
        }}
      />
    </div>
  );
}

interface ModulePermissionSectionProps {
  module: PermissionModule;
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
  onTogglePermission: (code: string, checked: boolean) => void;
  onPermissionScopeChange: (
    code: string,
    scope: PermissionScope | null,
  ) => void;
}

function ModulePermissionSection({
  expanded,
  module,
  disabled,
  onToggle,
  onTogglePermission,
  onPermissionScopeChange,
}: ModulePermissionSectionProps) {
  const intl = useIntl();

  return (
    <div className="border-b">
      <div className="grid grid-cols-[minmax(240px,1fr)_repeat(4,128px)] bg-background hover:bg-field">
        <div className="flex min-w-0 items-center gap-3 border-r px-5 py-3">
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background hover:bg-field"
            aria-label={
              expanded
                ? intl.formatMessage({ id: 'permissions.modules.collapse' })
                : intl.formatMessage({ id: 'permissions.modules.expand' })
            }
            onClick={onToggle}
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold leading-5">
              {module.name}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {module.description}
            </div>
          </div>
        </div>

        {PERMISSION_TAGS.map((tag) => (
          <div
            key={tag}
            className="flex items-center justify-center border-r px-3 py-3"
          >
            <SummaryStatus state={getTagSummary(module, tag)} tag={tag} />
          </div>
        ))}
      </div>

      {expanded && (
        <div className="bg-field/60 px-5 py-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {module.groups.map((group) => (
              <PermissionGroupCard
                key={group.name}
                group={group}
                disabled={disabled}
                onTogglePermission={onTogglePermission}
                onPermissionScopeChange={onPermissionScopeChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TagHeader({ tag }: { tag: PermissionTag }) {
  const intl = useIntl();
  const meta = tagMeta[tag];
  const Icon = meta.icon;

  return (
    <div className="flex items-center justify-center gap-1.5">
      <span
        className={cn(
          'inline-flex size-5 items-center justify-center rounded-md border',
          meta.className,
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span>{intl.formatMessage({ id: meta.messageId })}</span>
    </div>
  );
}

function IconWithTooltip({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent variant="light">{label}</TooltipContent>
    </Tooltip>
  );
}

function PermissionTagIcon({ tag }: { tag: PermissionTag }) {
  const intl = useIntl();
  const meta = tagMeta[tag];
  const Icon = meta.icon;

  return (
    <IconWithTooltip label={intl.formatMessage({ id: meta.messageId })}>
      <span
        className={cn(
          'inline-flex size-6 items-center justify-center rounded-md border',
          meta.className,
        )}
      >
        <Icon className="size-3.5" />
      </span>
    </IconWithTooltip>
  );
}

function SensitiveIcon() {
  const intl = useIntl();

  return (
    <IconWithTooltip
      label={intl.formatMessage({ id: 'permissions.tags.sensitive' })}
    >
      <span className="inline-flex size-6 items-center justify-center rounded-md border border-admin-amber-border bg-admin-amber-bg text-admin-amber-dark">
        <AlertTriangle className="size-3.5" />
      </span>
    </IconWithTooltip>
  );
}

function SummaryStatus({
  state,
  tag,
}: {
  state: SummaryState;
  tag: PermissionTag;
}) {
  const intl = useIntl();
  const meta = tagMeta[tag];

  if (state === 'na') {
    return (
      <Badge variant="secondary" appearance="light" size="sm">
        {intl.formatMessage({ id: 'permissions.tags.notApplicable' })}
      </Badge>
    );
  }

  return (
    <Checkbox
      disabled
      checked={state === 'partial' ? 'indeterminate' : state === 'all'}
      size="sm"
      className={cn(
        'disabled:cursor-default disabled:opacity-100',
        state === 'none' && 'opacity-50 disabled:opacity-50',
        state !== 'none' && meta.className,
      )}
    />
  );
}

interface PermissionGroupCardProps {
  group: PermissionModule['groups'][number];
  disabled: boolean;
  onTogglePermission: (code: string, checked: boolean) => void;
  onPermissionScopeChange: (
    code: string,
    scope: PermissionScope | null,
  ) => void;
}

function PermissionGroupCard({
  group,
  disabled,
  onTogglePermission,
  onPermissionScopeChange,
}: PermissionGroupCardProps) {
  const intl = useIntl();
  const selectedCount = group.permissions.filter(
    (permission) => permission.selected,
  ).length;
  const hasSensitive = group.permissions.some(
    (permission) => permission.sensitive,
  );

  return (
    <div className="rounded-md border bg-background">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <div className="font-semibold">{group.name}</div>
          <div className="text-xs text-muted-foreground">
            {intl.formatMessage(
              { id: 'permissions.groups.enabledCount' },
              { selected: selectedCount, total: group.permissions.length },
            )}
          </div>
        </div>
        {hasSensitive && <SensitiveIcon />}
      </div>
      <div className="divide-y">
        {group.permissions.map((permission) => (
          <PermissionRow
            key={permission.code}
            permission={permission}
            disabled={disabled}
            onTogglePermission={onTogglePermission}
            onPermissionScopeChange={onPermissionScopeChange}
          />
        ))}
      </div>
    </div>
  );
}

interface PermissionRowProps {
  permission: PermissionItem;
  disabled: boolean;
  onTogglePermission: (code: string, checked: boolean) => void;
  onPermissionScopeChange: (
    code: string,
    scope: PermissionScope | null,
  ) => void;
}

function PermissionRow({
  permission,
  disabled,
  onTogglePermission,
  onPermissionScopeChange,
}: PermissionRowProps) {
  const intl = useIntl();
  const scopeLabels: Record<PermissionScope, string> = {
    team: intl.formatMessage({ id: 'permissions.scopes.team' }),
    department: intl.formatMessage({ id: 'permissions.scopes.department' }),
    assigned_warehouses: intl.formatMessage({
      id: 'permissions.scopes.assignedWarehouses',
    }),
    all: intl.formatMessage({ id: 'permissions.scopes.all' }),
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-4 py-3 hover:bg-field',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
      )}
    >
      <div className="min-w-0">
        <span className="text-sm font-medium">{permission.name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {permission.tags.map((tag) => (
          <PermissionTagIcon key={tag} tag={tag} />
        ))}
        {permission.sensitive && <SensitiveIcon />}
        {permission.scopeOptions.length > 0 ? (
          <OptionSelect
            ariaLabel={intl.formatMessage(
              { id: 'permissions.scopes.selectLabel' },
              { permission: permission.name },
            )}
            value={permission.scope ?? 'none'}
            options={[
              {
                value: 'none',
                label: intl.formatMessage({ id: 'permissions.scopes.none' }),
              },
              ...permission.scopeOptions.map((scope) => ({
                value: scope,
                label: scopeLabels[scope],
              })),
            ]}
            placeholder={intl.formatMessage({ id: 'permissions.scopes.none' })}
            disabled={disabled}
            canDeselect={false}
            className="w-44"
            onChange={(value) =>
              onPermissionScopeChange(
                permission.code,
                value === 'none' ? null : (value as PermissionScope),
              )
            }
          />
        ) : (
          <Checkbox
            checked={permission.selected}
            disabled={disabled}
            aria-label={permission.name}
            onCheckedChange={(checked) =>
              onTogglePermission(permission.code, checked === true)
            }
          />
        )}
      </div>
    </div>
  );
}

interface RoleDeleteDialogProps {
  role: RoleSummary | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function RoleDeleteDialog({
  role,
  isDeleting,
  onClose,
  onConfirm,
}: RoleDeleteDialogProps) {
  const intl = useIntl();

  return (
    <AlertDialog open={!!role} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {intl.formatMessage({ id: 'permissions.roles.deleteDialog.title' })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <FormattedMessage
              id="permissions.roles.deleteDialog.description"
              values={{ role: <strong>{role?.name}</strong> }}
            />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {intl.formatMessage({ id: 'common.actions.cancel' })}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            loading={isDeleting}
            loadingText={intl.formatMessage({
              id: 'permissions.roles.deleteDialog.loading',
            })}
            onClick={onConfirm}
          >
            {intl.formatMessage({
              id: 'permissions.roles.deleteDialog.confirm',
            })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
