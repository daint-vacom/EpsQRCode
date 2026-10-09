import type { AuthUser } from '@/stores/auth.store';
import { env } from '@/config/env';
import { epsApi } from './eps-api-client';
import { getEpsCurrentEmployee } from './eps-reference.api';

export interface EpsLoginCredentials {
  userName: string;
  password: string;
}

export type EpsSessionUser = AuthUser;

export async function loginToEps(
  credentials: EpsLoginCredentials,
): Promise<EpsSessionUser> {
  await epsApi.post<unknown>('/auth/login', credentials);
  return getEpsSession();
}

export async function getEpsSession(): Promise<EpsSessionUser> {
  const employee = await getEpsCurrentEmployee();
  if (!employee.userId || !employee.fullName) {
    throw new Error('Không lấy được thông tin người dùng EPS sau đăng nhập.');
  }

  return {
    id: employee.userId,
    name: employee.fullName,
    email: employee.email ?? '',
    permissions: [],
  };
}

export async function logoutFromEps(): Promise<void> {
  await epsApi.post('/auth/logout');
}

export function startEpsSsoLogin(redirectTo = '/'): void {
  window.sessionStorage.setItem('eps-auth-redirect', redirectTo);
  const url = new URL(`${env.apiUrl}/auth/sso/login`, window.location.origin);
  window.location.assign(url.toString());
}
