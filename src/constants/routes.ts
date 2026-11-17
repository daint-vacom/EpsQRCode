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
    MATERIALS: '/vat-tu',
    WAREHOUSE_STOCK: '/vat-tu-kho',
    REPORTS: '/bao-cao',
    MATERIAL_CREATE: '/vat-tu/tao-moi',
    MATERIAL_EDIT: '/vat-tu/:id/chinh-sua',
    MATERIAL_DETAIL: '/vat-tu/:id',
    MATERIAL_QR_TRACKING: '/theo-doi-ma-qr',
    MATERIAL_SAFETY_INSPECTION_CREATE: '/vat-tu/:id/kiem-dinh/tao-moi',
    MATERIAL_SAFETY_INSPECTION_DETAIL: '/vat-tu/:id/kiem-dinh/:inspectionId',
    MATERIALS_REQUIRING_INSPECTION: '/vat-tu/can-kiem-tra',
    SAFETY_INSPECTIONS: '/phieu-kiem-tra-an-toan',
    MATERIAL_LABEL_TEMPLATES: '/mau-tem-nhan',
    MATERIAL_LABEL_TEMPLATE_CREATE: '/mau-tem-nhan/tao-moi',
    MATERIAL_LABEL_TEMPLATE_EDIT: '/mau-tem-nhan/:id/chinh-sua',
    MATERIAL_LABEL_PRINT: '/vat-tu/in-nhan',
    HANDOVERS: '/phieu-ban-giao',
    HANDOVER_CREATE: '/phieu-ban-giao/tao-moi',
    HANDOVER_EDIT: '/phieu-ban-giao/:id/chinh-sua',
    HANDOVER_DETAIL: '/phieu-ban-giao/:id',
    WAREHOUSE_HANDOVER_CREATE: '/phieu-ban-giao/nhan-tu-kho',
    CUSTODIANS: '/chu-the-ban-giao',
    EPS_ORGANIZATIONS: '/don-vi-eps',
    WAREHOUSES: '/kho',
    RECEIPTS: '/phieu-nhap-vat-tu',
    RECEIPT_CREATE: '/phieu-nhap-vat-tu/tao-moi',
    RECEIPT_EDIT: '/phieu-nhap-vat-tu/:id/chinh-sua',
    RECEIPT_DETAIL: '/phieu-nhap-vat-tu/:id',
    SETTINGS: '/cai-dat',
    ACCOUNTS: '/tai-khoan',
    EXTERNAL_ORGANIZATIONS: '/don-vi-ngoai',
    MATERIAL_GROUPS: '/nhom-vat-tu',
    MATERIAL_MODELS: '/mau-vat-tu',
    MATERIAL_SPECIFICATIONS: '/thong-so-vat-tu',
    MATERIAL_MODEL_CREATE: '/mau-vat-tu/tao-moi',
    MATERIAL_MODEL_EDIT: '/mau-vat-tu/:id/chinh-sua',
    ROLE_PERMISSIONS: '/phan-quyen',
    DATA_CONFIGURATION: '/cau-hinh-du-lieu',
    TAGS: '/danh-muc',
    FILES: '/tep-luu-tru',
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
