/**
 * Scaffolded by detail-builder from `src/project/handover/detail/handover.detail.fixture.ts`. Run `npm run gen:detail` — do NOT hand-write this file.
 * You own this file now — wire profile, information, actions, and tab content to screen logic.
 * To change the tab structure, edit the spec and re-gen to a scratch path first.
 */
import type { ReactNode } from 'react';
import { Boxes, History } from 'lucide-react';
import {
  EntityDetailLayout,
  EntityDetailTabs,
  type EntityDetailTab,
} from '@/components/layouts/entity-detail-layout';

export interface HandoverDetailLayoutProps {
  profile: ReactNode;
  information: ReactNode;
  itemsContent: ReactNode;
  historyContent: ReactNode;
  className?: string;
}
export function HandoverDetailLayout({
  profile,
  information,
  itemsContent,
  historyContent,
  className,
}: HandoverDetailLayoutProps) {
  const tabs: EntityDetailTab[] = [
    {
      value: 'items',
      label: 'Danh sách vật tư',
      icon: Boxes,
      content: itemsContent,
    },
    {
      value: 'history',
      label: 'Diễn biến',
      icon: History,
      content: historyContent,
    },
  ];

  return (
    <EntityDetailLayout
      profile={profile}
      information={information}
      tabs={<EntityDetailTabs tabs={tabs} defaultValue="items" />}
      className={className}
    />
  );
}
