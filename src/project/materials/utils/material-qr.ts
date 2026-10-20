import { buildPath, ROUTES } from '@/constants/routes';

export function getMaterialQrUrl(
  materialId: string,
  origin = typeof window === 'undefined' ? '' : window.location.origin,
): string {
  const path = buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, { id: materialId });
  return `${origin.replace(/\/$/, '')}${path}`;
}
