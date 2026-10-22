import { accountMessagesEn } from '@/project/accounts/messages';
import { handoverMessagesEn } from '@/project/handover/messages';
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
  ...materialMessagesEn,
  ...warehouseMessagesEn,
  ...accountMessagesEn,
  ...receiptMessagesEn,
  ...handoverMessagesEn,
  'permissions.scopes.selectLabel': 'Scope for {permission}',
  'permissions.scopes.none': 'None',
  'permissions.scopes.team': 'EPS team',
  'permissions.scopes.department': 'Department',
  'permissions.scopes.assignedWarehouses': 'Assigned warehouses',
  'permissions.scopes.all': 'All EPS data',
  'project.navigation.materials': 'Materials',
  'project.navigation.handovers': 'Handovers',
  'project.navigation.warehouses': 'Warehouses',
  'project.navigation.receipts': 'Material receipts',
  'project.navigation.custodians': 'Custodians',
  'project.navigation.accounts': 'Account management',
  'project.navigation.externalOrganizations': 'External organizations',
  'materialGroups.columns.groupShort': 'Material group',
  'materialModels.specifications.colorLabel': 'Color name',
  'materialModels.filters.searchPlaceholder': 'Search by model code or name',
  'materialModels.empty.search': 'No matching material models found.',
  'materialModels.select.placeholder': 'Select a material model',
};
