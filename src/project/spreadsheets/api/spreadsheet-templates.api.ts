import {
  createCustomFileFolder,
  deleteFileManagerItem,
  listFileFolders,
  listFileManagerItems,
  loadFileStorageReference,
  uploadFilesToFolder,
} from '@/project/files/api/file-manager.api';
import type { FileManagerItem } from '@/project/files/model/file-manager';
import {
  MAX_SPREADSHEET_FILE_BYTES,
  readXlsxFile,
  SpreadsheetError,
  type SpreadsheetWorkbook,
} from '@/lib/spreadsheets/xlsx';
import { createSignedStorageUrl } from '@/lib/storage';

export const SPREADSHEET_TEMPLATE_FOLDER_NAME = 'Biểu mẫu Excel';
export const SPREADSHEET_TEMPLATE_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const SPREADSHEET_TEMPLATE_DEFINITIONS = {
  materialsImport: {
    key: 'materialsImport',
    fileName: 'vat-tu-nhap.xlsx',
    bundledPath: '/templates/vat-tu-nhap.xlsx',
    titleMessageId: 'settings.spreadsheetTemplates.materialsImport',
  },
  materialsExport: {
    key: 'materialsExport',
    fileName: 'vat-tu-xuat.xlsx',
    bundledPath: '/templates/vat-tu-xuat.xlsx',
    titleMessageId: 'settings.spreadsheetTemplates.materialsExport',
  },
} as const;

export type SpreadsheetTemplateKey =
  keyof typeof SPREADSHEET_TEMPLATE_DEFINITIONS;

export interface SpreadsheetTemplate {
  key: SpreadsheetTemplateKey;
  fileName: string;
  updatedAt: string;
  workbook: SpreadsheetWorkbook;
}

function findTemplateFolder() {
  return listFileFolders().then(
    (folders) =>
      folders.find(
        (folder) =>
          folder.parentId === null &&
          folder.folderType === 'custom' &&
          folder.name === SPREADSHEET_TEMPLATE_FOLDER_NAME,
      ) ?? null,
  );
}

async function ensureTemplateFolder(userId: string) {
  const existingFolder = await findTemplateFolder();
  if (existingFolder) return existingFolder;

  try {
    await createCustomFileFolder(
      null,
      SPREADSHEET_TEMPLATE_FOLDER_NAME,
      userId,
    );
  } catch (error) {
    const folderAfterCreate = await findTemplateFolder().catch(() => null);
    if (folderAfterCreate) return folderAfterCreate;
    throw error;
  }

  const createdFolder = await findTemplateFolder();
  if (!createdFolder) {
    throw new Error('Không tìm thấy thư mục lưu biểu mẫu Excel vừa tạo.');
  }
  return createdFolder;
}

function getTemplateItem(
  items: FileManagerItem[],
  key: SpreadsheetTemplateKey,
) {
  const fileName = SPREADSHEET_TEMPLATE_DEFINITIONS[key].fileName;
  return items.find((item) => item.kind === 'file' && item.name === fileName);
}

interface SpreadsheetTemplateFile {
  fileName: string;
  updatedAt: string;
  blob: Blob;
}

async function loadBundledTemplateFile(
  key: SpreadsheetTemplateKey,
): Promise<SpreadsheetTemplateFile> {
  const definition = SPREADSHEET_TEMPLATE_DEFINITIONS[key];
  const response = await fetch(definition.bundledPath);
  if (!response.ok) {
    throw new Error('Không tải được biểu mẫu Excel mặc định.');
  }

  return {
    fileName: definition.fileName,
    updatedAt: '',
    blob: await response.blob(),
  };
}

async function loadSpreadsheetTemplateFile(
  key: SpreadsheetTemplateKey,
): Promise<SpreadsheetTemplateFile> {
  const folder = await findTemplateFolder().catch(() => null);
  if (!folder) return loadBundledTemplateFile(key);

  const items = await listFileManagerItems(folder.id).catch(() => null);
  if (!items) return loadBundledTemplateFile(key);
  const item = getTemplateItem(items, key);
  if (!item) return loadBundledTemplateFile(key);

  const reference = await loadFileStorageReference(item.id);
  const signedUrl = await createSignedStorageUrl(
    reference.storageBucket,
    reference.storagePath,
  );
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error('Không tải được biểu mẫu Excel dùng chung.');
  }

  return {
    fileName: item.name,
    updatedAt: item.modifiedAt,
    blob: await response.blob(),
  };
}

export async function loadSpreadsheetTemplate(
  key: SpreadsheetTemplateKey,
): Promise<SpreadsheetTemplate | null> {
  const templateFile = await loadSpreadsheetTemplateFile(key);
  const file = new File([templateFile.blob], templateFile.fileName, {
    type: templateFile.blob.type || SPREADSHEET_TEMPLATE_MIME_TYPE,
  });
  return {
    key,
    fileName: templateFile.fileName,
    updatedAt: templateFile.updatedAt,
    workbook: await readXlsxFile(file),
  };
}

export async function downloadSpreadsheetTemplateFile(
  key: SpreadsheetTemplateKey,
): Promise<{ fileName: string; blob: Blob }> {
  const templateFile = await loadSpreadsheetTemplateFile(key);
  const file = new File([templateFile.blob], templateFile.fileName, {
    type: templateFile.blob.type || SPREADSHEET_TEMPLATE_MIME_TYPE,
  });
  const workbook = await readXlsxFile(file);
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    fileName: templateFile.fileName,
    blob: new Blob([buffer], { type: SPREADSHEET_TEMPLATE_MIME_TYPE }),
  };
}

export async function saveSpreadsheetTemplate(input: {
  key: SpreadsheetTemplateKey;
  file: File;
  userId: string;
}): Promise<void> {
  const { key, file, userId } = input;
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new SpreadsheetError('common.spreadsheets.errors.fileType');
  }
  if (file.size > MAX_SPREADSHEET_FILE_BYTES) {
    throw new SpreadsheetError('common.spreadsheets.errors.fileSize');
  }

  const workbook = await readXlsxFile(file);
  const buffer = await workbook.xlsx.writeBuffer();
  if (buffer.byteLength > MAX_SPREADSHEET_FILE_BYTES) {
    throw new SpreadsheetError('common.spreadsheets.errors.fileSize');
  }

  const folder = await ensureTemplateFolder(userId);
  const definition = SPREADSHEET_TEMPLATE_DEFINITIONS[key];
  const normalizedFile = new File([buffer], definition.fileName, {
    type: file.type || SPREADSHEET_TEMPLATE_MIME_TYPE,
    lastModified: file.lastModified,
  });

  const [newFileId] = await uploadFilesToFolder(folder.id, userId, [
    normalizedFile,
  ]);
  if (!newFileId) {
    throw new Error('Không nhận được mã của biểu mẫu Excel vừa tải lên.');
  }
  const uploadedItems = await listFileManagerItems(folder.id);
  if (!uploadedItems.some((item) => item.id === newFileId)) {
    throw new Error('Không xác nhận được biểu mẫu Excel vừa tải lên.');
  }
  const staleItems = uploadedItems.filter(
    (item) =>
      item.kind === 'file' &&
      item.name === definition.fileName &&
      item.id !== newFileId,
  );
  await Promise.allSettled(staleItems.map(deleteFileManagerItem));
}
