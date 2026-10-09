import { useState } from 'react';
import { loginToEps, startEpsSsoLogin } from '@/features/eps/api/eps-auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { Building2, LogIn, ShieldCheck } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useIntl } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm, useLoginForm } from '../forms/login-form.generated';
import type { LoginFormValues } from '../forms/login-form.schema';

export function LoginPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSsoStarting, setIsSsoStarting] = useState(false);
  const form = useLoginForm();

  const handleSubmit = async (values: LoginFormValues) => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const user = await loginToEps({
        userName: values.identifier,
        password: values.password,
      });

      setAuth({ user, cookieSession: true });

      navigate(searchParams.get('redirect') || '/', { replace: true });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSsoLogin = () => {
    setErrorMessage(null);
    setIsSsoStarting(true);
    startEpsSsoLogin(searchParams.get('redirect') || '/');
  };

  return (
    <>
      <Helmet>
        <title>{intl.formatMessage({ id: 'auth.login.documentTitle' })}</title>
      </Helmet>
      <main className="flex min-h-svh w-full flex-1 items-center justify-center bg-muted px-4 py-8">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-4 pb-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="size-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl">
                {intl.formatMessage({ id: 'auth.login.welcome' })}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {intl.formatMessage({ id: 'auth.login.subtitle' })}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <LoginForm form={form} id="login-form" onSubmit={handleSubmit} />
              {errorMessage && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </p>
              )}
              <Button
                className="w-full"
                form="login-form"
                loading={isSubmitting}
                loadingText={intl.formatMessage({ id: 'auth.login.loading' })}
                type="submit"
              >
                <LogIn className="size-4" />
                {intl.formatMessage({ id: 'auth.login.submit' })}
              </Button>
              <Button
                className="w-full"
                disabled={isSubmitting || isSsoStarting}
                onClick={handleSsoLogin}
                type="button"
                variant="outline"
              >
                <Building2 className="size-4" />
                {intl.formatMessage({ id: 'auth.login.sso' })}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
