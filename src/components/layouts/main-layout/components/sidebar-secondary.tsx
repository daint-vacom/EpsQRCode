import { useUiStore } from '@/stores/ui.store';
import { useIntl } from 'react-intl';
import { Link, useLocation } from 'react-router-dom';
import { resolveMenuTarget } from '@/config/menu.types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLayout } from './context';
import { SidebarHeader } from './sidebar-header';

export function SidebarSecondary() {
  const intl = useIntl();
  const { pathname } = useLocation();
  const { shell } = useLayout();
  const wireframeMode = useUiStore((s) => s.wireframeMode);
  const isDark = shell.secondarySidebarVariant === 'dark';

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col',
        isDark ? 'bg-admin-shell-deep text-white' : 'bg-card text-foreground',
      )}
    >
      <SidebarHeader />
      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="[&>div]:!block [&>div]:!w-full [&>div]:!min-w-0"
      >
        <nav className="space-y-6 px-3 py-4">
          {shell.menuGroups.map((group) => {
            const items = group.items
              .map((item) => ({
                item,
                target: resolveMenuTarget(item, wireframeMode),
              }))
              .filter((entry) => entry.target !== null || entry.item.disabled);

            if (items.length === 0) return null;

            return (
              <section key={group.title}>
                <h2
                  className={cn(
                    'mb-2 px-3 text-xs font-semibold uppercase tracking-[0.08em]',
                    isDark ? 'text-white/45' : 'text-muted-foreground',
                  )}
                >
                  {group.title}
                </h2>
                <div className="space-y-1">
                  {items.map(({ item, target }) => {
                    const active = target ? pathname === target.to : false;
                    const Icon = item.icon;

                    const itemContent = (
                      <>
                        <Icon
                          className={cn(
                            'size-4.5 shrink-0',
                            isDark ? 'text-white/65' : 'text-foreground',
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                        {item.disabledLabelMessageId && (
                          <Badge
                            size="xs"
                            variant="secondary"
                            appearance="light"
                            className="shrink-0"
                          >
                            {intl.formatMessage({
                              id: item.disabledLabelMessageId,
                            })}
                          </Badge>
                        )}
                        {target?.isWireframe && (
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase',
                              item.badge === undefined && 'ml-auto',
                              isDark
                                ? 'bg-white/10 text-white/55'
                                : 'bg-border text-muted-foreground',
                            )}
                          >
                            block
                          </span>
                        )}
                      </>
                    );

                    return (
                      <div key={item.label} className="relative">
                        {target ? (
                          <Link
                            to={target.to}
                            className={cn(
                              'flex h-9 w-full min-w-0 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                              isDark
                                ? 'text-white/75 hover:bg-white/10 hover:text-white'
                                : 'text-foreground hover:bg-field hover:text-accent-foreground',
                              active &&
                                (isDark
                                  ? 'bg-primary text-white hover:bg-primary hover:text-white [&_svg]:text-white'
                                  : 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary [&_svg]:text-primary'),
                            )}
                          >
                            {itemContent}
                            {item.badge !== undefined && (
                              <Badge
                                size="sm"
                                shape="circle"
                                variant={active ? 'primary' : 'secondary'}
                                appearance={active ? 'default' : 'light'}
                                className="ms-auto shrink-0"
                              >
                                {item.badge}
                              </Badge>
                            )}
                          </Link>
                        ) : (
                          <div
                            aria-disabled="true"
                            aria-label={`${item.label}, ${intl.formatMessage({
                              id:
                                item.disabledLabelMessageId ??
                                'project.navigation.comingSoon',
                            })}`}
                            title={intl.formatMessage({
                              id:
                                item.disabledLabelMessageId ??
                                'project.navigation.comingSoon',
                            })}
                            className={cn(
                              'flex h-9 w-full min-w-0 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm font-medium opacity-55',
                              isDark ? 'text-white/75' : 'text-foreground',
                            )}
                          >
                            {itemContent}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>
      </ScrollArea>

      <div
        className={cn(
          'border-t px-4 py-3',
          isDark ? 'border-white/10' : 'border-border',
        )}
      >
        <p
          className={cn(
            'text-xs font-medium',
            isDark ? 'text-white/45' : 'text-admin-neutral-400',
          )}
        >
          v0.0.1
        </p>
      </div>
    </div>
  );
}
