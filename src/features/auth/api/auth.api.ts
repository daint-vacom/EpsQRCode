import { env } from '@/config/env';
import { assertSupabaseConfigured, supabaseAuthApi } from '@/lib/supabase';

export interface SupabaseAuthUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseAuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  user: SupabaseAuthUser;
}

function normalizeLoginEmail(identifier: string): string {
  const value = identifier.trim();
  if (value.includes('@')) return value;
  if (!env.supabaseLoginDomain) {
    throw new Error(
      'Vui lòng cấu hình VITE_SUPABASE_LOGIN_DOMAIN để dùng username đăng nhập.',
    );
  }
  return `${value}@${env.supabaseLoginDomain}`;
}

export async function signInWithPassword(
  identifier: string,
  password: string,
): Promise<SupabaseAuthSession> {
  assertSupabaseConfigured();

  return supabaseAuthApi.post<SupabaseAuthSession>(
    '/token?grant_type=password',
    {
      email: normalizeLoginEmail(identifier),
      password,
    },
  );
}

export async function refreshSupabaseSession(
  refreshToken: string,
): Promise<SupabaseAuthSession> {
  assertSupabaseConfigured();

  return supabaseAuthApi.post<SupabaseAuthSession>(
    '/token?grant_type=refresh_token',
    { refresh_token: refreshToken },
  );
}

export async function signOutFromSupabase(): Promise<void> {
  if (!env.supabaseEnabled) return;

  await supabaseAuthApi.post('/logout');
}

export async function changeSupabasePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const verificationSession = await signInWithPassword(email, currentPassword);

  await supabaseAuthApi.put(
    '/user',
    { password: newPassword },
    {
      headers: {
        Authorization: `Bearer ${verificationSession.access_token}`,
      },
    },
  );
}
