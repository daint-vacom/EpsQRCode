import { useAuthStore } from '@/stores/auth.store';
import type { AxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { createApiClient } from '@/lib/axios';

/** Cookie-only client for EPS endpoints exposed through the QR backend. */
interface UnwrappedEpsApiClient {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
}

export const epsApi = createApiClient(
  {
    baseURL: env.apiUrl,
    timeout: env.apiTimeoutMs,
    withCredentials: true,
  },
  {
    authMode: 'cookie',
    onUnauthorized: () => useAuthStore.getState().logout(),
  },
) as unknown as UnwrappedEpsApiClient;
