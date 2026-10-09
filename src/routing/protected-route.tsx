import { useAuthStore } from '@/stores/auth.store';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export function ProtectedRoute() {
  const token = useAuthStore((state) => state.token);
  const cookieSession = useAuthStore((state) => state.cookieSession);
  const location = useLocation();

  if (!token && !cookieSession) {
    const redirect = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(redirect)}`}
        replace
      />
    );
  }

  return <Outlet />;
}
