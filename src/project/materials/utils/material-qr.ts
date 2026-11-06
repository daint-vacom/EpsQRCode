import { buildPath, ROUTES } from '@/constants/routes';
import QRCode from 'qrcode';

export interface MaterialQrPngSource {
  id: string;
  code: string;
}

export function getMaterialQrUrl(
  materialId: string,
  origin = typeof window === 'undefined' ? '' : window.location.origin,
): string {
  return `${getMaterialDetailUrl(materialId, origin)}?open=scan`;
}

export function getMaterialDetailUrl(
  materialId: string,
  origin = typeof window === 'undefined' ? '' : window.location.origin,
): string {
  const path = buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, { id: materialId });
  return `${origin.replace(/\/$/, '')}${path}`;
}

export async function copyMaterialQrUrl(materialId: string): Promise<void> {
  await copyMaterialQrUrls([materialId]);
}

export async function copyMaterialQrUrls(
  materialIds: readonly string[],
): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard access is unavailable.');
  }
  const urls = materialIds.map((id) => getMaterialQrUrl(id)).join('\n');
  await navigator.clipboard.writeText(urls);
}

export async function downloadMaterialQrPngs(
  materials: readonly MaterialQrPngSource[],
): Promise<void> {
  const files = await Promise.all(
    materials.map(async (material) => ({
      filename: `${material.code}-qr.png`,
      imageUrl: await QRCode.toDataURL(getMaterialQrUrl(material.id), {
        errorCorrectionLevel: 'M',
        margin: 4,
        width: 1024,
        color: { dark: '#111827', light: '#ffffff' },
      }),
    })),
  );

  for (const file of files) {
    const download = document.createElement('a');
    download.href = file.imageUrl;
    download.download = file.filename;
    download.click();
  }
}
