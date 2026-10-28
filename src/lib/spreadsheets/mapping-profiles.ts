import {
  getSpreadsheetHeaders,
  normalizeHeader,
  type SpreadsheetField,
  type SpreadsheetMapping,
} from './xlsx';

export interface SpreadsheetMappingProfile {
  version: 1;
  fileName: string;
  worksheetName: string;
  headerRow: number;
  dataStartRow: number;
  headersByFieldKey: Record<string, string>;
}

export function loadSpreadsheetMappingProfile(
  userId: string | null,
  entityKey: string,
  fileName: string,
): SpreadsheetMappingProfile | null {
  if (!userId || typeof localStorage === 'undefined') return null;
  try {
    const profiles = JSON.parse(
      localStorage.getItem(getStorageKey(userId, entityKey)) ?? '{}',
    ) as Record<string, SpreadsheetMappingProfile>;
    const profile = profiles[fileName];
    return profile?.version === 1 ? profile : null;
  } catch {
    return null;
  }
}

export function saveSpreadsheetMappingProfile(
  userId: string | null,
  entityKey: string,
  profile: SpreadsheetMappingProfile,
): void {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    const key = getStorageKey(userId, entityKey);
    const profiles = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<
      string,
      SpreadsheetMappingProfile
    >;
    localStorage.setItem(
      key,
      JSON.stringify({ ...profiles, [profile.fileName]: profile }),
    );
  } catch {
    // Mapping profiles are a convenience and must not block import/export.
  }
}

export function resolveSpreadsheetMappingProfile<TRecord>(
  worksheet: {
    name: string;
    getRow: (row: number) => {
      getCell: (column: number) => { value: unknown; text?: string };
      eachCell?: (
        options: { includeEmpty?: boolean },
        callback: (
          cell: { value: unknown; text?: string },
          column: number,
        ) => void,
      ) => void;
    };
  },
  fields: SpreadsheetField<TRecord>[],
  profile: SpreadsheetMappingProfile | null,
): SpreadsheetMapping | null {
  if (!profile || profile.worksheetName !== worksheet.name) return null;
  const headers = getSpreadsheetHeaders(worksheet, profile.headerRow);
  const available = new Map(
    headers.map((header) => [normalizeHeader(header.label), header.column]),
  );
  const columnByFieldKey: Record<string, number> = {};
  for (const field of fields) {
    const label = profile.headersByFieldKey[field.key];
    const column = label ? available.get(normalizeHeader(label)) : undefined;
    if (column) columnByFieldKey[field.key] = column;
  }
  if (Object.keys(columnByFieldKey).length < 2) return null;
  return {
    worksheetName: worksheet.name,
    headerRow: profile.headerRow,
    dataStartRow: profile.dataStartRow,
    columnByFieldKey,
  };
}

export function makeSpreadsheetMappingProfile<TRecord>(
  fileName: string,
  mapping: SpreadsheetMapping,
  headers: Array<{ column: number; label: string }>,
  fields: SpreadsheetField<TRecord>[],
): SpreadsheetMappingProfile {
  const labelByColumn = new Map(
    headers.map((header) => [header.column, header.label]),
  );
  return {
    version: 1,
    fileName,
    worksheetName: mapping.worksheetName,
    headerRow: mapping.headerRow,
    dataStartRow: mapping.dataStartRow,
    headersByFieldKey: Object.fromEntries(
      fields.flatMap((field) => {
        const column = mapping.columnByFieldKey[field.key];
        const label = column ? labelByColumn.get(column) : undefined;
        return label ? [[field.key, label]] : [];
      }),
    ),
  };
}

function getStorageKey(userId: string, entityKey: string): string {
  return `epsqrcode:spreadsheet-mappings:v1:${userId}:${entityKey}`;
}
