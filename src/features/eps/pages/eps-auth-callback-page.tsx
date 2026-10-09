import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { getEpsSession } from '../api/eps-auth.api';

export function EpsAuthCallbackPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void getEpsSession()
      .then((user) => {
        if (!isActive) return;
        setAuth({ user, cookieSession: true });
        const redirectTo =
          window.sessionStorage.getItem('eps-auth-redirect') || '/';
        window.sessionStorage.removeItem('eps-auth-redirect');
        navigate(redirectTo, { replace: true });
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setErrorMessage(getApiErrorMessage(error));
      });

    return () => {
      isActive = false;
    };
  }, [navigate, setAuth]);

  if (!errorMessage) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">
          Đang xác nhận phiên đăng nhập EPS...
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="text-sm text-destructive">{errorMessage}</p>
        <Button onClick={() => navigate('/login', { replace: true })}>
          Quay lại đăng nhập
        </Button>
      </div>
    </main>
  );
}
