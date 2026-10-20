import { handoverMessagesEn } from '@/project/handover/messages';
import { materialMessagesEn } from '@/project/materials/messages';

/** English translations for the material operations modules. */
export const en: Record<string, string> = {
  'common.actions.retry': 'Retry',
  'common.state.loading': 'Loading',
  'common.actions.loadMore': 'Load more',
  'common.select.loadingMore': 'Loading more',
  'common.select.loadError': 'Unable to load data',
  'common.select.minSearch': 'Enter at least {count} characters to search',
  ...materialMessagesEn,
  ...handoverMessagesEn,
  'project.navigation.materials': 'Materials',
  'project.navigation.handovers': 'Handovers',
  'project.navigation.custodians': 'Custodians',
  'materialGroups.columns.groupShort': 'Material group',
  'materialModels.specifications.colorLabel': 'Color name',
  'materialModels.filters.searchPlaceholder': 'Search by model code or name',
  'materialModels.empty.search': 'No matching material models found.',
  'materialModels.select.placeholder': 'Select a material model',
};
