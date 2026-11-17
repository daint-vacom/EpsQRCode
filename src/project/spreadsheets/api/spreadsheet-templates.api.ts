import {
  createCustomFileFolder,
  deleteFileManagerItem,
  listFileFolders,
  listFileManagerItems,
  loadFileStorageReference,
  uploadFilesToFolder,
} from '@/project/files/api/file-manager.api';
import type {
  FileFolder,
  FileManagerItem,
} from '@/project/files/model/file-manager';
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
export const BUNDLED_SPREADSHEET_TEMPLATE_PREFIX = 'bundled:';

export const SPREADSHEET_TEMPLATE_DEFINITIONS = {
  materialsImport: {
    key: 'materialsImport',
    fileName: 'vat-tu-nhap.xlsx',
    bundledPath: '/templates/vat-tu-nhap.xlsx',
    folderName: 'Nhập vật tư',
    titleMessageId: 'settings.spreadsheetTemplates.materialsImport',
  },
  materialsExport: {
    key: 'materialsExport',
    fileName: 'vat-tu-xuat.xlsx',
    bundledPath: '/templates/vat-tu-xuat.xlsx',
    folderName: 'Xuất vật tư',
    titleMessageId: 'settings.spreadsheetTemplates.materialsExport',
  },
} as const;

export type SpreadsheetTemplateKey =
  keyof typeof SPREADSHEET_TEMPLATE_DEFINITIONS;

export interface SpreadsheetTemplateSummary {
  id: string;
  key: SpreadsheetTemplateKey;
  fileName: string;
  updatedAt: string;
  isBundled: boolean;
}

export interface SpreadsheetTemplate extends SpreadsheetTemplateSummary {
  workbook: SpreadsheetWorkbook;
}

interface SpreadsheetTemplateFile extends SpreadsheetTemplateSummary {
  blob: Blob;
}

function bundledTemplateId(key: SpreadsheetTemplateKey) {
  return `${BUNDLED_SPREADSHEET_TEMPLATE_PREFIX}${key}`;
}

function getBundledTemplateSummary(
  key: SpreadsheetTemplateKey,
): SpreadsheetTemplateSummary {
  return {
    id: bundledTemplateId(key),
    key,
    fileName: SPREADSHEET_TEMPLATE_DEFINITIONS[key].fileName,
    updatedAt: '',
    isBundled: true,
  };
}

async function findTemplateFolder(): Promise<FileFolder | null> {
  const folders = await listFileFolders();
  return (
    folders.find(
      (folder) =>
        folder.parentId === null &&
        folder.folderType === 'custom' &&
        folder.name === SPREADSHEET_TEMPLATE_FOLDER_NAME,
    ) ?? null
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

async function ensureTemplateCategoryFolder(
  key: SpreadsheetTemplateKey,
  userId: string,
) {
  const parentFolder = await ensureTemplateFolder(userId);
  const findCategoryFolder = async () => {
    const folders = await listFileFolders();
    return (
      folders.find(
        (folder) =>
          folder.parentId === parentFolder.id &&
          folder.folderType === 'custom' &&
          folder.name === SPREADSHEET_TEMPLATE_DEFINITIONS[key].folderName,
      ) ?? null
    );
  };

  const existingFolder = await findCategoryFolder();
  if (existingFolder) return existingFolder;

  try {
    await createCustomFileFolder(
      parentFolder.id,
      SPREADSHEET_TEMPLATE_DEFINITIONS[key].folderName,
      userId,
    );
  } catch (error) {
    const folderAfterCreate = await findCategoryFolder().catch(() => null);
    if (folderAfterCreate) return folderAfterCreate;
    throw error;
  }

  const createdFolder = await findCategoryFolder();
  if (!createdFolder) {
    throw new Error('Không tìm thấy thư mục lưu biểu mẫu Excel vừa tạo.');
  }
  return createdFolder;
}

async function listSharedTemplateItems(
  key: SpreadsheetTemplateKey,
): Promise<FileManagerItem[]> {
  const rootFolder = await findTemplateFolder();
  if (!rootFolder) return [];

  const rootItems = await listFileManagerItems(rootFolder.id);
  const categoryFolder = rootItems.find(
    (item) =>
      item.kind === 'folder' &&
      item.name === SPREADSHEET_TEMPLATE_DEFINITIONS[key].folderName,
  );
  const categoryItems = categoryFolder
    ? await listFileManagerItems(categoryFolder.id)
    : [];
  const legacyTemplateName = SPREADSHEET_TEMPLATE_DEFINITIONS[key].fileName;
  const legacyItems = rootItems.filter(
    (item) =>
      item.kind === 'file' &&
      item.name.toLowerCase() === legacyTemplateName.toLowerCase(),
  );
  const categoryFiles = categoryItems.filter(
    (item) => item.kind === 'file' && item.name.toLowerCase().endsWith('.xlsx'),
  );
  const itemsById = new Map<string, FileManagerItem>();
  for (const item of [...legacyItems, ...categoryFiles]) {
    itemsById.set(item.id, item);
  }

  return [...itemsById.values()].sort(
    (left, right) =>
      right.modifiedAt.localeCompare(left.modifiedAt) ||
      left.name.localeCompare(right.name, 'vi'),
  );
}

export async function listSpreadsheetTemplates(
  key: SpreadsheetTemplateKey,
): Promise<SpreadsheetTemplateSummary[]> {
  const sharedItems = await listSharedTemplateItems(key);
  const sharedTemplates = sharedItems.map((item) => ({
    id: item.id,
    key,
    fileName: item.name,
    updatedAt: item.modifiedAt,
    isBundled: false,
  }));

  return [...sharedTemplates, getBundledTemplateSummary(key)];
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
    ...getBundledTemplateSummary(key),
    blob: await response.blob(),
  };
}

async function loadSpreadsheetTemplateFile(
  key: SpreadsheetTemplateKey,
  templateId?: string,
): Promise<SpreadsheetTemplateFile> {
  const templates = await listSpreadsheetTemplates(key);
  const template = templateId
    ? templates.find((item) => item.id === templateId)
    : templates[0];
  if (!template) {
    throw new Error('Không tìm thấy biểu mẫu Excel cần tải.');
  }
  if (template.isBundled) return loadBundledTemplateFile(key);

  const reference = await loadFileStorageReference(template.id);
  const signedUrl = await createSignedStorageUrl(
    reference.storageBucket,
    reference.storagePath,
  );
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error('Không tải được biểu mẫu Excel dùng chung.');
  }

  return {
    ...template,
    fileName: reference.fileName,
    blob: await response.blob(),
  };
}

export async function loadSpreadsheetTemplate(
  key: SpreadsheetTemplateKey,
  templateId?: string,
): Promise<SpreadsheetTemplate> {
  const templateFile = await loadSpreadsheetTemplateFile(key, templateId);
  const file = new File([templateFile.blob], templateFile.fileName, {
    type: templateFile.blob.type || SPREADSHEET_TEMPLATE_MIME_TYPE,
  });
  const workbook = await readXlsxFile(file);
  return {
    id: templateFile.id,
    key: templateFile.key,
    fileName: templateFile.fileName,
    updatedAt: templateFile.updatedAt,
    isBundled: templateFile.isBundled,
    workbook,
  };
}

export async function downloadSpreadsheetTemplateFile(
  key: SpreadsheetTemplateKey,
  templateId?: string,
): Promise<{ fileName: string; blob: Blob }> {
  const templateFile = await loadSpreadsheetTemplateFile(key, templateId);
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

  const categoryFolder = await ensureTemplateCategoryFolder(key, userId);
  const normalizedFile = new File([buffer], file.name, {
    type: file.type || SPREADSHEET_TEMPLATE_MIME_TYPE,
    lastModified: file.lastModified,
  });
  const [newFileId] = await uploadFilesToFolder(categoryFolder.id, userId, [
    normalizedFile,
  ]);
  if (!newFileId) {
    throw new Error('Không nhận được mã của biểu mẫu Excel vừa tải lên.');
  }

  const [uploadedItems, rootFolder] = await Promise.all([
    listFileManagerItems(categoryFolder.id),
    findTemplateFolder(),
  ]);
  const newItem = uploadedItems.find((item) => item.id === newFileId);
  if (!newItem || newItem.kind !== 'file') {
    throw new Error('Không xác nhận được biểu mẫu Excel vừa tải lên.');
  }

  const rootItems = rootFolder ? await listFileManagerItems(rootFolder.id) : [];
  const staleItems = [...uploadedItems, ...rootItems].filter(
    (item) =>
      item.kind === 'file' &&
      item.name.toLowerCase() === file.name.toLowerCase() &&
      item.id !== newFileId,
  );
  await Promise.allSettled(staleItems.map(deleteFileManagerItem));
}

export async function deleteSpreadsheetTemplate(
  key: SpreadsheetTemplateKey,
  templateId: string,
): Promise<void> {
  if (templateId.startsWith(BUNDLED_SPREADSHEET_TEMPLATE_PREFIX)) {
    throw new Error('Biểu mẫu mặc định tích hợp sẵn không thể xóa.');
  }

  const item = (await listSharedTemplateItems(key)).find(
    (candidate) => candidate.id === templateId,
  );
  if (!item) throw new Error('Không tìm thấy biểu mẫu Excel cần xóa.');
  await deleteFileManagerItem(item);
}
