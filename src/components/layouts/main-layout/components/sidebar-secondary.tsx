import { useUiStore } from '@/stores/ui.store';
import { useIntl } from 'react-intl';
import { Link, useLocation } from 'react-router-dom';
import { resolveMenuTarget } from '@/config/menu.types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLayout } from './context';
import { SidebarHeader } from './sidebar-header';

export function SidebarSecondary({
  collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const intl = useIntl();
  const { pathname } = useLocation();
  const { shell } = useLayout();
  const wireframeMode = useUiStore((s) => s.wireframeMode);
  const isDark = shell.secondarySidebarVariant === 'dark';
  const menuGroups = shell.menuGroups
    .map((group) => ({
      group,
      items: group.items
        .map((item) => ({
          item,
          target: resolveMenuTarget(item, wireframeMode),
        }))
        .filter((entry) => entry.target !== null || entry.item.disabled),
    }))
    .filter(({ items }) => items.length > 0);

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col',
        isDark ? 'bg-admin-shell-deep text-white' : 'bg-card text-foreground',
      )}
    >
      <SidebarHeader collapsed={collapsed} />
      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="[&>div]:!block [&>div]:!w-full [&>div]:!min-w-0"
      >
        <nav
          className={cn(
            'flex flex-col',
            collapsed ? 'space-y-3 px-2 py-3' : 'space-y-6 px-3 py-4',
          )}
        >
          {menuGroups.map(({ group, items }, groupIndex) => {
            return (
              <section key={group.title}>
                {!collapsed && (
                  <h2
                    className={cn(
                      'mb-2 px-3 text-xs font-semibold uppercase tracking-[0.08em]',
                      isDark ? 'text-white/45' : 'text-muted-foreground',
                    )}
                  >
                    {group.title}
                  </h2>
                )}
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
                        {!collapsed && (
                          <>
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
                        )}
                      </>
                    );

                    const itemLink = target ? (
                      <Link
                        to={target.to}
                        aria-label={item.label}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex h-9 min-w-0 items-center rounded-lg text-sm font-medium transition-colors',
                          collapsed
                            ? 'mx-auto w-10 justify-center px-0'
                            : 'w-full gap-3 px-3',
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
                        {!collapsed && item.badge !== undefined && (
                          <Badge
                            size="sm"
                            shape="circle"
                            variant="destructive"
                            appearance="default"
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
                          'flex h-9 min-w-0 cursor-not-allowed items-center rounded-lg text-sm font-medium opacity-55',
                          collapsed
                            ? 'mx-auto w-10 justify-center px-0'
                            : 'w-full gap-3 px-3',
                          isDark ? 'text-white/75' : 'text-foreground',
                        )}
                      >
                        {itemContent}
                      </div>
                    );

                    return (
                      <div key={item.label} className="relative">
                        {collapsed ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{itemLink}</TooltipTrigger>
                            <TooltipContent side="right" sideOffset={8}>
                              {item.label}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          itemLink
                        )}
                      </div>
                    );
                  })}
                </div>
                {collapsed && groupIndex < menuGroups.length - 1 && (
                  <Separator
                    className={cn(
                      'mx-auto mt-3 w-4.5',
                      isDark ? 'bg-white/20' : 'bg-border',
                    )}
                  />
                )}
              </section>
            );
          })}
        </nav>
      </ScrollArea>

      {!collapsed && (
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
      )}
    </div>
  );
}
