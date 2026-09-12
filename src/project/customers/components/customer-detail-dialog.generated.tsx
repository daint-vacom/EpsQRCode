/**
 * Scaffolded by detail-dialog-builder from `src/project/customers/detail/customer-detail-dialog.fixture.ts`. Run `npm run gen:detail-dialog` — do NOT hand-write this file.
 * You own this file now — wire local data and tab content to screen logic.
 * To change the tab structure, edit the spec and re-gen to a scratch path first.
 */
import type { ReactNode } from 'react';
import { Info, KeyRound, List, Users } from 'lucide-react';
import {
  EntityDetailDialog,
  EntityDetailDialogTable,
  type EntityDetailDialogField,
  type EntityDetailDialogTab,
  type EntityDetailDialogTabContext,
} from '@/components/layouts/entity-detail-dialog';

export interface CustomerDetailDialogShellProps<TData> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  data: TData | null;
  isLoading?: boolean;
  searchPlaceholder?: string;
  generalFields: (
    context: EntityDetailDialogTabContext<TData>,
  ) => EntityDetailDialogField[];
  customContent: (context: EntityDetailDialogTabContext<TData>) => ReactNode;
  responsibilityContent: (
    context: EntityDetailDialogTabContext<TData>,
  ) => ReactNode;
  softwareAccountsContent: (
    context: EntityDetailDialogTabContext<TData>,
  ) => ReactNode;
  generalSearchText?: (data: TData) => string;
  customSearchText?: (data: TData) => string;
  responsibilitySearchText?: (data: TData) => string;
  softwareAccountsSearchText?: (data: TData) => string;
  generalSearchMatchCount?: (
    context: EntityDetailDialogTabContext<TData>,
  ) => number;
  customSearchMatchCount?: (
    context: EntityDetailDialogTabContext<TData>,
  ) => number;
  responsibilitySearchMatchCount?: (
    context: EntityDetailDialogTabContext<TData>,
  ) => number;
  softwareAccountsSearchMatchCount?: (
    context: EntityDetailDialogTabContext<TData>,
  ) => number;
  className?: string;
}
export function CustomerDetailDialogShell<TData>({
  open,
  onOpenChange,
  title,
  data,
  isLoading,
  searchPlaceholder = 'Tìm kiếm dữ liệu',
  generalFields,
  customContent,
  responsibilityContent,
  softwareAccountsContent,
  generalSearchText,
  customSearchText,
  responsibilitySearchText,
  softwareAccountsSearchText,
  generalSearchMatchCount,
  customSearchMatchCount,
  responsibilitySearchMatchCount,
  softwareAccountsSearchMatchCount,
  className,
}: CustomerDetailDialogShellProps<TData>) {
  const tabs: EntityDetailDialogTab<TData>[] = [
    {
      value: 'general',
      label: 'Thông tin chung',
      icon: Info,
      searchText: generalSearchText,
      getMatchCount: generalSearchMatchCount,
      content: (context) => (
        <EntityDetailDialogTable
          fields={generalFields(context)}
          matches={context.matches}
        />
      ),
    },
    {
      value: 'custom',
      label: 'Thông tin bổ sung',
      icon: List,
      searchText: customSearchText,
      getMatchCount: customSearchMatchCount,
      content: customContent,
    },
    {
      value: 'responsibility',
      label: 'Nhân viên phụ trách',
      icon: Users,
      searchText: responsibilitySearchText,
      getMatchCount: responsibilitySearchMatchCount,
      content: responsibilityContent,
    },
    {
      value: 'softwareAccounts',
      label: 'Tài khoản phần mềm',
      icon: KeyRound,
      searchText: softwareAccountsSearchText,
      getMatchCount: softwareAccountsSearchMatchCount,
      content: softwareAccountsContent,
    },
  ];

  return (
    <EntityDetailDialog<TData>
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      data={data}
      isLoading={isLoading}
      tabs={tabs}
      defaultTab="general"
      searchPlaceholder={searchPlaceholder}
      className={className}
    />
  );
}
