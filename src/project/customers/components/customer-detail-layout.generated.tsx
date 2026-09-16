/**
 * Scaffolded by detail-builder from `src/project/customers/detail/customer-detail-layout.fixture.ts`. Run `npm run gen:detail` — do NOT hand-write this file.
 * You own this file now — wire profile, information, actions, and tab content to screen logic.
 * To change the tab structure, edit the spec and re-gen to a scratch path first.
 */
import type { ReactNode } from 'react';
import {
  CircleDollarSign,
  FileText,
  KeyRound,
  LayoutDashboard,
  Users,
} from 'lucide-react';
import {
  EntityDetailLayout,
  EntityDetailTabs,
  type EntityDetailTab,
} from '@/components/layouts/entity-detail-layout';

export interface CustomerDetailLayoutProps {
  profile: ReactNode;
  information: ReactNode;
  overviewContent: ReactNode;
  debtsContent: ReactNode;
  contractsContent: ReactNode;
  employeesContent: ReactNode;
  softwareAccountsContent: ReactNode;
  className?: string;
}
export function CustomerDetailLayout({
  profile,
  information,
  overviewContent,
  debtsContent,
  contractsContent,
  employeesContent,
  softwareAccountsContent,
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
      value: 'debts',
      label: 'Công nợ',
      icon: CircleDollarSign,
      content: debtsContent,
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
      value: 'softwareAccounts',
      label: 'Tài khoản phần mềm',
      icon: KeyRound,
      content: softwareAccountsContent,
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
