import type { ComponentProps } from 'react';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';

const FILE_TYPE_ASSETS: Record<string, string> = {
  ai: 'ai.svg',
  apk: 'apk.svg',
  css: 'css.svg',
  doc: 'word.svg',
  docx: 'word.svg',
  fig: 'figma.svg',
  figma: 'figma.svg',
  iso: 'iso.svg',
  js: 'javascript.svg',
  json: 'text.svg',
  mp3: 'music.svg',
  mp4: 'video-1.svg',
  php: 'php.svg',
  pdf: 'pdf.svg',
  ppt: 'ppt.svg',
  pptx: 'ppt.svg',
  psd: 'psd.svg',
  rar: 'zip.svg',
  sql: 'sql.svg',
  svg: 'svg.svg',
  ttf: 'ttf.svg',
  txt: 'text.svg',
  wav: 'music.svg',
  webm: 'video-1.svg',
  xls: 'excel.svg',
  xlsx: 'excel.svg',
  zip: 'zip.svg',
};

function getExtension(fileName: string | null | undefined) {
  const normalizedName = fileName?.trim().toLowerCase() ?? '';
  const extension = normalizedName.split('.').pop();
  return extension && extension !== normalizedName ? extension : '';
}

export function getFileIcon(
  fileType: string | null | undefined,
  fileName?: string | null,
) {
  const normalizedType = fileType?.toLowerCase() ?? '';
  const extension = getExtension(fileName);

  if (
    normalizedType.startsWith('image/') ||
    extension === 'jpg' ||
    extension === 'jpeg' ||
    extension === 'png' ||
    extension === 'gif'
  ) {
    return 'image.svg';
  }
  if (
    normalizedType.startsWith('video/') ||
    extension === 'mp4' ||
    extension === 'webm'
  ) {
    return 'video-1.svg';
  }
  if (
    normalizedType.startsWith('audio/') ||
    extension === 'mp3' ||
    extension === 'wav'
  ) {
    return 'music.svg';
  }
  if (normalizedType.includes('pdf') || extension === 'pdf') return 'pdf.svg';

  if (
    normalizedType.includes('spreadsheetml') ||
    normalizedType.includes('excel') ||
    normalizedType.includes('sheet') ||
    extension === 'csv'
  ) {
    return 'excel.svg';
  }
  if (
    normalizedType.includes('wordprocessingml') ||
    normalizedType.includes('msword') ||
    normalizedType.includes('word')
  ) {
    return 'word.svg';
  }
  if (
    normalizedType.includes('presentationml') ||
    normalizedType.includes('powerpoint')
  ) {
    return 'ppt.svg';
  }
  if (
    normalizedType.includes('zip') ||
    normalizedType.includes('rar') ||
    normalizedType.includes('archive')
  ) {
    return 'zip.svg';
  }
  if (normalizedType.includes('json')) return 'text.svg';
  if (normalizedType.includes('javascript')) return 'javascript.svg';
  if (normalizedType.includes('text')) return 'text.svg';

  return FILE_TYPE_ASSETS[extension] ?? 'text.svg';
}

export interface FileIconProps extends ComponentProps<'img'> {
  fileType: string | null | undefined;
  fileName?: string | null;
}

export function FileIcon({
  fileType,
  fileName,
  alt,
  className,
  ...props
}: FileIconProps) {
  if (!fileType && !fileName) return null;

  return (
    <img
      src={toAbsoluteUrl(
        `/media/file-types/${getFileIcon(fileType, fileName)}`,
      )}
      alt={alt ?? fileName ?? 'Tệp'}
      className={cn('size-5 object-contain', className)}
      {...props}
    />
  );
}
