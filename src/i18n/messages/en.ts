import { accountMessagesEn } from '@/project/accounts/messages';
import { custodianMessagesEn } from '@/project/custodians/messages';
import { handoverMessagesEn } from '@/project/handover/messages';
import { materialMessagesEn } from '@/project/materials/messages';
import { receiptMessagesEn } from '@/project/receipts/messages';
import { warehouseMessagesEn } from '@/project/warehouses/messages';

/** English translations for the material operations modules. */
export const en: Record<string, string> = {
  'common.actions.retry': 'Retry',
  'common.spreadsheets.errors.fileType':
    'Choose an Excel file in .xlsx format.',
  'common.spreadsheets.errors.unavailable':
    'Excel processing could not be initialized in this browser.',
  'common.spreadsheets.errors.fileSize':
    'The Excel file exceeds the 20 MB limit.',
  'common.spreadsheets.errors.noWorksheets':
    'The Excel file has no worksheets to process.',
  'common.spreadsheets.errors.rowLimit':
    'The worksheet exceeds the 50,000 row limit.',
  'common.spreadsheets.errors.worksheetMissing':
    'The selected worksheet was not found.',
  'common.spreadsheets.errors.mappingEmpty':
    'No data columns were recognized in the template. Add field keys in the first row or use standard column headers.',
  'common.spreadsheets.errors.exportLimit':
    'The export exceeds the 50,000 row limit.',
  'common.state.loading': 'Loading',
  'common.actions.loadMore': 'Load more',
  'common.select.loadingMore': 'Loading more',
  'common.select.loadError': 'Unable to load data',
  'common.select.minSearch': 'Enter at least {count} characters to search',
  ...materialMessagesEn,
  ...warehouseMessagesEn,
  ...accountMessagesEn,
  ...custodianMessagesEn,
  ...receiptMessagesEn,
  ...handoverMessagesEn,
  'permissions.scopes.selectLabel': 'Scope for {permission}',
  'permissions.scopes.none': 'None',
  'permissions.scopes.team': 'EPS team',
  'permissions.scopes.department': 'Department',
  'permissions.scopes.assignedWarehouses': 'Assigned warehouses',
  'permissions.scopes.all': 'All EPS data',
  'project.navigation.groups.workspace': 'Workspace',
  'project.navigation.groups.reports': 'Reports',
  'project.navigation.groups.organization': 'Organization management',
  'project.navigation.groups.system': 'System',
  'project.navigation.materials': 'Material management',
  'project.navigation.reports': 'Reports',
  'project.navigation.handovers': 'Handovers',
  'project.navigation.warehouses': 'Warehouses',
  'project.navigation.receipts': 'Material receipts',
  'project.navigation.epsOrganizations': 'EPS organizations',
  'project.navigation.accounts': 'Login accounts',
  'project.navigation.externalOrganizations': 'External organizations',
  'project.navigation.materialModels': 'Material models',
  'project.navigation.materialGroups': 'Material groups',
  'project.navigation.materialSpecifications': 'Technical specifications',
  'project.navigation.files': 'File storage',
  'project.navigation.rolePermissions': 'Permissions',
  'project.navigation.settings': 'Settings',
  'settings.tabs.account': 'Account',
  'settings.tabs.organization': 'Organization',
  'settings.tabs.spreadsheetTemplates': 'Templates',
  'settings.spreadsheetTemplates.title': 'Excel templates',
  'settings.spreadsheetTemplates.materialsImport': 'Import materials',
  'settings.spreadsheetTemplates.materialsExport': 'Export materials',
  'settings.spreadsheetTemplates.chooseFile': 'Choose an .xlsx template',
  'settings.spreadsheetTemplates.fileHelp':
    'Choose an .xlsx file to add or replace the template. Maximum size: 20 MB.',
  'settings.spreadsheetTemplates.saved': 'Excel template updated.',
  'settings.spreadsheetTemplates.loadErrorTitle':
    'Could not load Excel templates',
  'reports.page.title': 'Reports',
  'reports.mock.heading': 'Report mock page',
  'reports.mock.description': 'Report content and data will be added later.',
  'materialGroups.columns.groupShort': 'Material group',
  'materialModels.specifications.colorLabel': 'Color name',
  'materialModels.filters.searchPlaceholder': 'Search by model code or name',
  'materialModels.empty.search': 'No matching material models found.',
  'materialModels.select.placeholder': 'Select a material model',
};
