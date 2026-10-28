import { useId } from 'react';
import { changeSupabasePassword } from '@/features/auth/api/auth.api';
import { loadMyQrCodeAccount } from '@/project/accounts/api/accounts.api';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { KeyRound, LockKeyhole, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardLoading } from '@/components/ui/loading';
import {
  accountPasswordSchema,
  type AccountPasswordFormValues,
} from '../model/account-password';

const passwordFormId = 'account-password-form';

export function AccountSettings() {
  const intl = useIntl();
  const { user, userId } = useUser();
  const accountQuery = useQuery({
    queryKey: ['project', 'my-qrcode-account', userId],
    queryFn: () => loadMyQrCodeAccount(),
    enabled: Boolean(userId),
  });
  const passwordForm = useForm<AccountPasswordFormValues>({
    resolver: zodResolver(accountPasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (values: AccountPasswordFormValues) => {
      if (!user?.email) throw new Error('Tài khoản chưa có email đăng nhập.');
      await changeSupabasePassword(
        user.email,
        values.currentPassword,
        values.newPassword,
      );
    },
    onSuccess: () => {
      passwordForm.reset();
      toast.success(
        intl.formatMessage({ id: 'accounts.password.toasts.updated' }),
      );
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, {
          fallbackMessage: intl.formatMessage({
            id: 'accounts.password.toasts.error',
          }),
        }),
      );
    },
  });

  const profile = accountQuery.data;
  const profileName =
    profile?.accountType === 'eps'
      ? profile.epsEmployeeName
      : profile?.displayName;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-5">
          <CardHeading>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4 text-primary" />
              {intl.formatMessage({ id: 'accounts.settings.profile.title' })}
            </CardTitle>
          </CardHeading>
        </CardHeader>
        <CardContent className="p-5">
          {accountQuery.isPending ? (
            <CardLoading
              label={intl.formatMessage({ id: 'common.state.loading' })}
            />
          ) : accountQuery.isError ? (
            <ErrorState
              title={intl.formatMessage({
                id: 'accounts.settings.profile.error',
              })}
              description={getApiErrorMessage(accountQuery.error)}
              onRetry={() => void accountQuery.refetch()}
              retryLabel={intl.formatMessage({ id: 'common.actions.retry' })}
            />
          ) : profile ? (
            <div className="space-y-4">
              <ReadOnlyField
                label={intl.formatMessage({
                  id: 'accounts.settings.profile.name',
                })}
                value={
                  profileName ||
                  intl.formatMessage({
                    id: 'accounts.settings.profile.unmapped',
                  })
                }
              />
              <ReadOnlyField
                label={intl.formatMessage({
                  id: 'accounts.settings.profile.username',
                })}
                value={profile.username ?? ''}
              />
              <ReadOnlyField
                label={intl.formatMessage({ id: 'accounts.fields.type' })}
                value={intl.formatMessage({
                  id:
                    profile.accountType === 'eps'
                      ? 'accounts.types.eps'
                      : profile.accountType === 'external'
                        ? 'accounts.types.external'
                        : 'accounts.types.unmapped',
                })}
              />
              <ReadOnlyField
                label={intl.formatMessage({ id: 'accounts.fields.status' })}
                value={intl.formatMessage({
                  id: `accounts.status.${profile.status}`,
                })}
              />
              {profile.accountType === 'eps' ? (
                <>
                  <ReadOnlyField
                    label={intl.formatMessage({
                      id: 'accounts.settings.profile.epsCode',
                    })}
                    value={profile.epsEmployeeCode ?? ''}
                  />
                  <ReadOnlyField
                    label={intl.formatMessage({
                      id: 'accounts.settings.profile.epsStatus',
                    })}
                    value={
                      profile.epsEmploymentStatus
                        ? intl.formatMessage({
                            id: `accounts.settings.profile.epsStatus.${profile.epsEmploymentStatus}`,
                          })
                        : ''
                    }
                  />
                  <ReadOnlyField
                    label={intl.formatMessage({
                      id: 'accounts.settings.profile.department',
                    })}
                    value={profile.epsDepartmentName ?? ''}
                  />
                  <ReadOnlyField
                    label={intl.formatMessage({
                      id: 'accounts.settings.profile.team',
                    })}
                    value={profile.epsTeamName ?? ''}
                  />
                </>
              ) : profile.accountType === 'external' ? (
                <ReadOnlyField
                  label={intl.formatMessage({
                    id: 'accounts.fields.externalOrganization',
                  })}
                  value={profile.externalOrganizationName ?? ''}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {intl.formatMessage({
                    id: 'accounts.settings.profile.mappingNotice',
                  })}
                </p>
              )}
            </div>
          ) : (
            <ErrorState
              title={intl.formatMessage({
                id: 'accounts.settings.profile.error',
              })}
              description={intl.formatMessage({
                id: 'accounts.settings.profile.missing',
              })}
              onRetry={() => void accountQuery.refetch()}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-5">
          <CardHeading>
            <CardTitle className="flex items-center gap-2 text-base">
              <LockKeyhole className="size-4 text-primary" />
              {intl.formatMessage({ id: 'accounts.settings.security.title' })}
            </CardTitle>
          </CardHeading>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="space-y-2">
            <div className="grid grid-cols-[8.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
              <Label
                variant="secondary"
                className="pt-2"
                htmlFor="account-email"
              >
                {intl.formatMessage({ id: 'accounts.settings.security.email' })}
              </Label>
              <Input id="account-email" value={user?.email ?? ''} readOnly />
            </div>
          </div>
          <div className="border-t border-border pt-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="size-4 text-muted-foreground" />
              {intl.formatMessage({
                id: 'accounts.settings.security.password',
              })}
            </h3>
            <Form {...passwordForm}>
              <form
                id={passwordFormId}
                onSubmit={passwordForm.handleSubmit((values) =>
                  passwordMutation.mutate(values),
                )}
                className="mt-4 space-y-5"
              >
                <div className="space-y-5">
                  <PasswordField
                    form={passwordForm}
                    name="currentPassword"
                    label={intl.formatMessage({
                      id: 'accounts.settings.security.currentPassword',
                    })}
                    autoComplete="current-password"
                  />
                  <PasswordField
                    form={passwordForm}
                    name="newPassword"
                    label={intl.formatMessage({
                      id: 'accounts.settings.security.newPassword',
                    })}
                    autoComplete="new-password"
                  />
                  <PasswordField
                    form={passwordForm}
                    name="confirmPassword"
                    label={intl.formatMessage({
                      id: 'accounts.settings.security.confirmPassword',
                    })}
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs leading-5 text-muted-foreground">
                    {intl.formatMessage({
                      id: 'accounts.settings.security.confirmHint',
                    })}
                  </p>
                  <Button
                    type="submit"
                    variant="primary"
                    className="shrink-0"
                    loading={passwordMutation.isPending}
                    loadingText={intl.formatMessage({
                      id: 'accounts.settings.security.saving',
                    })}
                  >
                    {intl.formatMessage({
                      id: 'accounts.settings.security.updatePassword',
                    })}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const fieldId = useId();
  return (
    <div className="grid grid-cols-[8.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
      <Label variant="secondary" className="pt-2" htmlFor={fieldId}>
        {label}
      </Label>
      <Input id={fieldId} value={value} readOnly />
    </div>
  );
}

function PasswordField({
  form,
  name,
  label,
  autoComplete,
}: {
  form: ReturnType<typeof useForm<AccountPasswordFormValues>>;
  name: keyof AccountPasswordFormValues;
  label: string;
  autoComplete: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem layout="horizontal" labelWidth="md">
          <FormLabel>
            {label}
            <span className="text-destructive"> *</span>
          </FormLabel>
          <FormControl>
            <Input type="password" autoComplete={autoComplete} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
