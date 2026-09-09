import { env } from '@/config/env';
import { assertSupabaseConfigured, supabaseStorageApi } from './supabase';

export function getStorageItem<T>(key: string): T | undefined {
  try {
    const storage = globalThis.localStorage;
    const value = storage.getItem(key);

    if (value === null) {
      return undefined;
    }

    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  try {
    globalThis.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can be unavailable or full; persistence is best effort.
  }
}

export const TENANT_ASSETS_BUCKET = 'tenant-assets';

export interface StorageObjectInput {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
}

export async function uploadStorageObject({
  bucket,
  path,
  file,
  upsert = false,
}: StorageObjectInput): Promise<void> {
  assertSupabaseConfigured();

  await supabaseStorageApi.post(`/object/${bucket}/${path}`, file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': String(upsert),
    },
  });
}

export async function removeStorageObjects(
  bucket: string,
  paths: string[],
): Promise<void> {
  const normalizedPaths = Array.from(
    new Set(paths.map((path) => path.trim()).filter(Boolean)),
  );
  if (normalizedPaths.length === 0) return;

  assertSupabaseConfigured();
  await supabaseStorageApi.delete(`/object/${bucket}`, {
    data: { prefixes: normalizedPaths },
    headers: { 'Content-Type': 'application/json' },
  });
}

export function getPublicStorageUrl(bucket: string, path: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

interface SignedStorageUrlResponse {
  signedURL?: string;
  signedUrl?: string;
}

function encodeStoragePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function normalizeSignedStorageUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;

  const normalized = value.replace(/^\/+/, '');
  if (normalized.startsWith('storage/v1/')) {
    return `${env.supabaseUrl}/${normalized}`;
  }

  return `${env.supabaseUrl}/storage/v1/${normalized}`;
}

/**
 * Creates a short-lived URL for a private Storage object.
 *
 * The request is made with the current user's JWT, so Storage RLS remains the
 * authorization boundary. Never replace this with a service role key in the
 * browser bundle.
 */
export async function createSignedStorageUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 300,
): Promise<string> {
  assertSupabaseConfigured();

  const response = await supabaseStorageApi.post<SignedStorageUrlResponse>(
    `/object/sign/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`,
    { expiresIn: expiresInSeconds },
  );
  const signedUrl = response.signedURL ?? response.signedUrl;

  if (!signedUrl) {
    throw new Error('Không thể tạo liên kết xem tệp tạm thời.');
  }

  return normalizeSignedStorageUrl(signedUrl);
}
