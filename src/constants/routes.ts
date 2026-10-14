/**
 * Tập trung path routes — không hardcode string path trong component.
 * Khi thêm trang mới, khai báo path ở đây và đăng ký trong
 * `src/routing/app-routing-setup.tsx`.
 */
export const ROUTES = {
  HOME: '/',
  EXAMPLE: {
    EMPLOYEES: '/example/employees',
    EMPLOYEE_DETAIL: '/example/employees/:id',
    ORDERS: '/example/orders',
    ORDER_EDIT: '/example/orders/edit',
    MATERIALS: '/example/materials',
    MATERIAL_CREATE: '/example/materials/new',
    MATERIAL_EDIT: '/example/materials/:id/edit',
    MATERIAL_SPECS: '/example/materials/specs',
    MATERIAL_INSPECTIONS: '/example/materials/inspections',
    MATERIAL_MODELS_DEMO: '/example/materials/models',
    MATERIAL_MODEL_DEMO_CREATE: '/example/materials/models/new',
    MATERIAL_MODEL_DEMO_EDIT: '/example/materials/models/:id/edit',
    MATERIAL_PUBLIC_DETAIL: '/example/materials/public/:id',
    SUPPLIERS: '/example/suppliers',
    CHARTS: '/example/charts',
    SETTINGS: '/example/settings',
    CONTENT_LAYOUT_TWO_COLUMN: '/example/content-layouts/two-column',
    OPERATIONS_DASHBOARD: '/example/operations-dashboard',
  },
  PROJECT: {
    SETTINGS: '/settings',
    EMPLOYEES: '/employees',
    MATERIAL_GROUPS: '/material-groups',
    MATERIAL_MODELS: '/material-models',
    MATERIAL_MODEL_CREATE: '/material-models/new',
    MATERIAL_MODEL_EDIT: '/material-models/:id/edit',
    ROLE_PERMISSIONS: '/permissions',
    DATA_CONFIGURATION: '/data-configuration',
    TAGS: '/tags',
    FILES: '/files',
  },
} as const;

/** Thay thế param `:key` trong path. buildPath(ROUTES.EXAMPLE.EMPLOYEE_DETAIL, { id }) */
export function buildPath(
  path: string,
  params: Record<string, string>,
): string {
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(`:${key}`, value),
    path,
  );
}
