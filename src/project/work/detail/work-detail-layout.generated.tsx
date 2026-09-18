/**
 * Scaffolded by detail-builder from `src/project/work/detail/work-detail-layout.fixture.ts`. Run `npm run gen:detail` — do NOT hand-write this file.
 * You own this file now — wire profile, information, actions, and tab content to screen logic.
 * To change the tab structure, edit the spec and re-gen to a scratch path first.
 */
import type { ReactNode } from 'react';
import { LayoutDashboard, ListChecks } from 'lucide-react';
import {
  EntityDetailLayout,
  EntityDetailTabs,
  type EntityDetailTab,
} from '@/components/layouts/entity-detail-layout';

export interface WorkDetailLayoutProps {
  profile: ReactNode;
  information: ReactNode;
  overviewContent: ReactNode;
  childrenContent: ReactNode;
  className?: string;
}
export function WorkDetailLayout({
  profile,
  information,
  overviewContent,
  childrenContent,
  className,
}: WorkDetailLayoutProps) {
  const tabs: EntityDetailTab[] = [
    {
      value: 'overview',
      label: 'Tổng quan',
      icon: LayoutDashboard,
      content: overviewContent,
    },
    {
      value: 'children',
      label: 'Đầu mục con',
      icon: ListChecks,
      content: childrenContent,
    },
  ];

  return (
    <EntityDetailLayout
      profile={profile}
      information={information}
      tabs={<EntityDetailTabs tabs={tabs} defaultValue="overview" />}
      className={className}
    />
  );
}
