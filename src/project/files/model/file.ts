export const FILE_SUBJECT_TYPES = {
  contract: 'contract',
  workItem: 'work_item',
} as const;

export type FileSubjectType =
  (typeof FILE_SUBJECT_TYPES)[keyof typeof FILE_SUBJECT_TYPES];

export interface FileAttachment {
  /** The file_links id used to detach this file from a subject. */
  id: string;
  fileId: string;
  tenantId: string;
  subjectType: FileSubjectType;
  subjectId: string;
  relationType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
  url: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
  createdBy: string | null;
  createdAt: string;
}

export type FilePreviewSource = Pick<FileAttachment, 'fileName' | 'mimeType'>;

export type FileThumbnailKind =
  | 'image'
  | 'pdf'
  | 'text'
  | 'video'
  | 'unsupported';

function getFileExtension(fileName: string) {
  const normalizedName = fileName.trim().toLowerCase();
  const extension = normalizedName.split('.').pop();
  return extension && extension !== normalizedName ? extension : '';
}

export function getFileThumbnailKind(
  file: FilePreviewSource,
): FileThumbnailKind {
  const mimeType = file.mimeType.toLowerCase();
  const extension = getFileExtension(file.fileName);

  if (
    mimeType.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)
  ) {
    return 'image';
  }
  if (mimeType.includes('pdf') || extension === 'pdf') return 'pdf';
  if (
    mimeType.startsWith('text/') ||
    ['csv', 'json', 'log', 'md', 'xml', 'yaml', 'yml'].includes(extension)
  ) {
    return 'text';
  }
  if (
    mimeType.startsWith('video/') ||
    ['mp4', 'webm', 'ogg'].includes(extension)
  ) {
    return 'video';
  }

  return 'unsupported';
}

export function isOfficeDocument(file: FilePreviewSource): boolean {
  return (
    file.mimeType.includes('msword') ||
    file.mimeType.includes('wordprocessingml') ||
    file.mimeType.includes('ms-excel') ||
    file.mimeType.includes('spreadsheetml') ||
    file.mimeType.includes('ms-powerpoint') ||
    file.mimeType.includes('presentationml') ||
    /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(file.fileName)
  );
}

export function buildOfficeViewerUrl(signedUrl: string): string {
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(signedUrl)}&wdOrigin=BROWSELINK`;
}
