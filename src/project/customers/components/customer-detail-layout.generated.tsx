/**
 * Scaffolded by detail-builder from `src/project/customers/detail/customer-detail-layout.fixture.ts`. Run `npm run gen:detail` — do NOT hand-write this file.
 * You own this file now — wire profile, information, actions, and tab content to screen logic.
 * To change the tab structure, edit the spec and re-gen to a scratch path first.
 */
import type { ReactNode } from 'react';
import { BarChart3, FileText, LayoutDashboard, Users } from 'lucide-react';
import {
  EntityDetailLayout,
  EntityDetailTabs,
  type EntityDetailTab,
} from '@/components/layouts/entity-detail-layout';

export interface CustomerDetailLayoutProps {
  profile: ReactNode;
  information: ReactNode;
  overviewContent: ReactNode;
  contractsContent: ReactNode;
  employeesContent: ReactNode;
  reportsContent: ReactNode;
  className?: string;
}
export function CustomerDetailLayout({
  profile,
  information,
  overviewContent,
  contractsContent,
  employeesContent,
  reportsContent,
  className,
}: CustomerDetailLayoutProps) {
  const tabs: EntityDetailTab[] = [
    {
      value: 'overview',
      label: 'Tổng quan',
      icon: LayoutDashboard,
      content: overviewContent,
    },
    {
      value: 'contracts',
      label: 'Hợp đồng',
      icon: FileText,
      content: contractsContent,
    },
    {
      value: 'employees',
      label: 'Nhân viên phụ trách',
      icon: Users,
      content: employeesContent,
    },
    {
      value: 'reports',
      label: 'Báo cáo',
      icon: BarChart3,
      content: reportsContent,
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
