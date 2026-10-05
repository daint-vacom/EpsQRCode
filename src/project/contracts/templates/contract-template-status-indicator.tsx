import {
  CONTRACT_TEMPLATE_STATUS_LABELS,
  type ContractTemplateStatus,
} from '../model/contract-template';

const statusDotColors: Record<ContractTemplateStatus, string> = {
  draft: 'var(--admin-neutral-400)',
  published: 'var(--admin-success-dot)',
  archived: 'var(--admin-red-primary)',
};

export function ContractTemplateStatusIndicator({
  status,
}: {
  status: ContractTemplateStatus;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground">
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full opacity-100"
        style={{ backgroundColor: statusDotColors[status] }}
      />
      <span className="truncate">
        {CONTRACT_TEMPLATE_STATUS_LABELS[status]}
      </span>
    </span>
  );
}
