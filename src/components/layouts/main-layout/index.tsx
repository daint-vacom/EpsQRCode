import type { CSSProperties } from 'react';
import { Helmet } from 'react-helmet-async';
import { LayoutProvider } from './components/context';
import type { LayoutShellConfig } from './components/context';
import { Wrapper } from './components/wrapper';

interface MainLayoutProps {
  shell?: Partial<LayoutShellConfig>;
}

export function MainLayout({ shell }: MainLayoutProps = {}) {
  return (
    <>
      <Helmet>
        <title>{shell?.brandName ?? 'Admin Template'}</title>
      </Helmet>

      <LayoutProvider
        bodyClassName="bg-muted overflow-hidden"
        shell={shell}
        style={
          {
            '--sidebar-width': '224px',
            '--sidebar-collapsed-width': '64px',
            '--header-height': '56px',
            '--header-height-mobile': '56px',
          } as CSSProperties
        }
      >
        <Wrapper />
      </LayoutProvider>
    </>
  );
}
