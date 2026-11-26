import { BarChart3 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { PROJECT_FEATURE_ICONS } from '@/config/project-feature-icons';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ReportsPage() {
  const intl = useIntl();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-4 lg:px-5 lg:pt-5">
        <PageHeader
          title={intl.formatMessage({ id: 'reports.page.title' })}
          icon={PROJECT_FEATURE_ICONS.reports}
        />
      </div>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="h-full">
        <div className="px-4 pb-4 pt-4 lg:px-5 lg:pb-5 lg:pt-5">
          <Card>
            <CardContent className="flex min-h-56 flex-col items-center justify-center gap-2 text-center">
              <BarChart3
                className="size-8 text-muted-foreground"
                aria-hidden="true"
              />
              <h2 className="text-base font-semibold text-foreground">
                {intl.formatMessage({ id: 'reports.mock.heading' })}
              </h2>
              <p className="max-w-lg text-sm text-muted-foreground">
                {intl.formatMessage({ id: 'reports.mock.description' })}
              </p>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
