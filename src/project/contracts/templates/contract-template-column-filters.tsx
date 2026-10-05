import type { MultiSelectOption } from '@/components/ui/multi-select';
import {
  CONTRACT_TEMPLATE_STATUS_LABELS,
  CONTRACT_TEMPLATE_STATUSES,
} from '../model/contract-template';
import { ContractTemplateStatusIndicator } from './contract-template-status-indicator';

export const CONTRACT_TEMPLATE_STATUS_FILTER_OPTIONS: MultiSelectOption[] =
  CONTRACT_TEMPLATE_STATUSES.map((status) => ({
    value: status,
    label: <ContractTemplateStatusIndicator status={status} />,
    searchableText: CONTRACT_TEMPLATE_STATUS_LABELS[status],
    data: status,
  }));
