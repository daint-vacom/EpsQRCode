export interface MaterialCapitalSource {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MaterialCapitalSourceRow {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export function mapMaterialCapitalSourceRow(
  row: MaterialCapitalSourceRow,
): MaterialCapitalSource {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}
