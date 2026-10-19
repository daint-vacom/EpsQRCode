import { handoverMessagesEn } from '@/project/handover/messages';
import { materialMessagesEn } from '@/project/materials/messages';

/** English translations for the material operations modules. */
export const en: Record<string, string> = {
  ...materialMessagesEn,
  ...handoverMessagesEn,
  'project.navigation.materials': 'Materials',
  'project.navigation.handovers': 'Handovers',
  'project.navigation.custodians': 'Custodians',
};
