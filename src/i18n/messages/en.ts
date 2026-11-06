import { accountMessagesEn } from '@/project/accounts/messages';
import { custodianMessagesEn } from '@/project/custodians/messages';
import { handoverMessagesEn } from '@/project/handover/messages';
import { materialLabelMessagesEn } from '@/project/material-labels/messages';
import { materialMessagesEn } from '@/project/materials/messages';
import { receiptMessagesEn } from '@/project/receipts/messages';
import { warehouseMessagesEn } from '@/project/warehouses/messages';

/** English translations for the material operations modules. */
export const en: Record<string, string> = {
  'common.actions.retry': 'Retry',
  'common.state.loading': 'Loading',
  'common.actions.loadMore': 'Load more',
  'common.select.loadingMore': 'Loading more',
  'common.select.loadError': 'Unable to load data',
  'common.select.minSearch': 'Enter at least {count} characters to search',
  'editorTable.selection.toolbar': 'Bulk actions',
  'editorTable.selection.selected': '{count} rows selected',
  'editorTable.selection.clipboardReady': '{count} copied rows are ready',
  'editorTable.selection.copy': 'Copy',
  'editorTable.selection.paste': 'Paste',
  'editorTable.selection.delete': 'Delete selected rows',
  'editorTable.selection.edit': 'Bulk edit',
  'editorTable.selection.action': 'Action',
  'editorTable.selection.chooseAction': 'Choose an action',
  'editorTable.selection.apply': 'Apply',
  'editorTable.selection.clear': 'Clear selection',
  ...materialMessagesEn,
  ...materialLabelMessagesEn,
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
  'project.navigation.groups.warehouseManagement': 'Warehouse management',
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
  'reports.page.title': 'Reports',
  'reports.mock.heading': 'Report mock page',
  'reports.mock.description': 'Report content and data will be added later.',
  'materialGroups.columns.groupShort': 'Material group',
  'materialGroups.tabs.general': 'Group information',
  'materialGroups.tabs.technical': 'Technical specifications',
  'materialGroups.tabs.inspection': 'Safety inspection',
  'materialGroups.specifications.tableTitle':
    'Material group technical specifications',
  'materialGroups.errors.loadTitle': 'Could not load material group',
  'materialModels.specifications.groupTableTitle':
    'Technical specifications table: {groupName}',
  'materialModels.specifications.groupTableTitleFallback':
    'Material group technical specifications',
  'materialModels.specifications.groupTableEmpty':
    'This group has no technical specifications.',
  'materialModels.specifications.groupTableUnselected':
    'Select a material group to view inherited specifications.',
  'materialModels.specifications.modelTableTitle':
    'Material model technical specifications',
  'materialModels.fields.externalCodes': 'Linked material codes',
  'materialModels.fields.requiresInspection': 'Periodic inspection',
  'materialModels.fields.useGroupSafetyInspectionChecklist':
    'Use the material group inspection checklist',
  'materialModels.specifications.colorLabel': 'Color name',
  'materialModels.specifications.selection.selectAll':
    'Select all technical specifications',
  'materialModels.specifications.selection.selectRow':
    'Select specification {name}',
  'materialModels.specifications.selection.toolbar':
    'Technical specification actions',
  'materialModels.specifications.selection.selected':
    '{count} specifications selected',
  'materialModels.specifications.selection.copy':
    'Copy technical specifications',
  'materialModels.specifications.selection.delete': 'Delete selected rows',
  'materialModels.specifications.selection.pasteCount':
    'Paste {count} copied specifications',
  'materialModels.specifications.selection.moreActions':
    'Open specification menu',
  'materialModels.specifications.selection.clear': 'Clear selection',
  'materialModels.specifications.selection.copyError':
    'Could not copy the selected specifications.',
  'materialModels.specifications.selection.copied':
    'Copied {count} technical specifications.',
  'materialModels.specifications.selection.pasted':
    'Added {count} technical specifications.',
  'materialModels.specifications.selection.deleted':
    'Deleted {count} technical specifications.',
  'materialModels.specifications.selection.deletedMaterial':
    'Deleted {count} specifications from this material.',
  'materialModels.filters.searchPlaceholder': 'Search by model code or name',
  'materialModels.empty.search': 'No matching material models found.',
  'materialModels.select.placeholder': 'Select a material model',
};
