import { createContext, useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import type { PageHeaderProps } from '@/components/ui/page-header';
import { PageHeader } from '@/components/ui/page-header';

export type DetailEntryHeaderConfig = Omit<PageHeaderProps, 'className'>;

const DEFAULT_HEADER: DetailEntryHeaderConfig = {
  title: 'Chi tiết',
};

const DetailEntryHeaderContext = createContext<
  ((header: DetailEntryHeaderConfig) => void) | null
>(null);

export function DetailEntryLayout() {
  const [header, setHeader] = useState(DEFAULT_HEADER);

  return (
    <DetailEntryHeaderContext.Provider value={setHeader}>
      <div className="fixed inset-0 flex h-dvh min-h-0 w-full min-w-0 flex-col overflow-hidden bg-muted text-foreground">
        <header className="z-10 flex h-14 shrink-0 items-center border-b border-border bg-card px-3 lg:px-4">
          <PageHeader {...header} className="w-full" />
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden" role="main">
          <Outlet />
        </main>
      </div>
    </DetailEntryHeaderContext.Provider>
  );
}

export function useDetailEntryLayoutHeader(header: DetailEntryHeaderConfig) {
  const setHeader = useContext(DetailEntryHeaderContext);

  if (!setHeader) {
    throw new Error(
      'useDetailEntryLayoutHeader must be used inside DetailEntryLayout.',
    );
  }

  useEffect(() => {
    setHeader(header);
    return () => setHeader(DEFAULT_HEADER);
  }, [header, setHeader]);
}
