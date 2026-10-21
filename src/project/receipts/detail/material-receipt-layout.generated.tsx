/**
 * Scaffolded by detail-builder from `src/project/receipts/detail/material-receipt.detail.fixture.ts`. Run `npm run gen:detail` — do NOT hand-write this file.
 * You own this file now — wire profile, information, actions, and tab content to screen logic.
 * To change the tab structure, edit the spec and re-gen to a scratch path first.
 */
import type { ReactNode } from 'react';
import { ArrowRightLeft, ClipboardList } from 'lucide-react';
import { useIntl } from 'react-intl';
import {
  EntityDetailLayout,
  EntityDetailTabs,
  type EntityDetailTab,
} from '@/components/layouts/entity-detail-layout';

export interface MaterialReceiptDetailLayoutProps {
  profile: ReactNode;
  information: ReactNode;
  detailsContent: ReactNode;
  handoversContent: ReactNode;
  className?: string;
}
export function MaterialReceiptDetailLayout({
  profile,
  information,
  detailsContent,
  handoversContent,
  className,
}: MaterialReceiptDetailLayoutProps) {
  const intl = useIntl();
  const tabs: EntityDetailTab[] = [
    {
      value: 'details',
      label: intl.formatMessage({ id: 'receipts.tabs.details' }),
      icon: ClipboardList,
      content: detailsContent,
    },
    {
      value: 'handovers',
      label: intl.formatMessage({ id: 'receipts.tabs.handovers' }),
      icon: ArrowRightLeft,
      content: handoversContent,
    },
  ];

  return (
    <EntityDetailLayout
      profile={profile}
      information={information}
      tabs={<EntityDetailTabs tabs={tabs} defaultValue="details" />}
      className={className}
    />
  );
}
