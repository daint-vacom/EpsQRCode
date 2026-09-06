import { useUiStore } from '@/stores/ui.store';
import { Pin } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getMenuItemKey, resolveMenuTarget } from '@/config/menu.types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLayout } from './context';
import { SidebarHeader } from './sidebar-header';

export function SidebarSecondary() {
  const { pathname } = useLocation();
  const { shell } = useLayout();
  const wireframeMode = useUiStore((s) => s.wireframeMode);
  const pinnedMenuPaths = useUiStore((s) => s.pinnedMenuPaths);
  const togglePinnedMenu = useUiStore((s) => s.togglePinnedMenu);
  const isDark = shell.secondarySidebarVariant === 'dark';

  return (
    <div
      className={cn(
        'flex w-(--sidebar-menu-width) min-w-0 flex-col border-s',
        isDark
          ? 'border-white/15 bg-admin-neutral-900 text-white'
          : 'border-border bg-card text-foreground',
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
              .filter((entry) => entry.target !== null);

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
                    const active = pathname === target!.to;
                    const Icon = item.icon;

                    const menuKey = getMenuItemKey(item);
                    const pinned = pinnedMenuPaths.includes(menuKey);

                    return (
                      <div
                        key={item.label}
                        className="group/menu-item relative"
                      >
                        <Link
                          to={target!.to}
                          className={cn(
                            'flex h-9 w-full min-w-0 items-center gap-3 rounded-lg px-3 pe-12 text-sm font-medium transition-colors',
                            isDark
                              ? 'text-white/75 hover:bg-white/10 hover:text-white'
                              : 'text-foreground hover:bg-field hover:text-accent-foreground',
                            active &&
                              (isDark
                                ? 'bg-primary text-white hover:bg-primary hover:text-white [&_svg]:text-white'
                                : 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary [&_svg]:text-primary'),
                          )}
                        >
                          <Icon
                            className={cn(
                              'size-4.5 shrink-0',
                              isDark ? 'text-white/65' : 'text-foreground',
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                          {target!.isWireframe && (
                            <span
                              className={cn(
                                'ml-auto rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase',
                                isDark
                                  ? 'bg-white/10 text-white/55'
                                  : 'bg-border text-muted-foreground',
                              )}
                            >
                              block
                            </span>
                          )}
                        </Link>
                        {item.badge !== undefined && (
                          <Badge
                            size="sm"
                            shape="circle"
                            variant={active ? 'primary' : 'secondary'}
                            appearance={active ? 'default' : 'light'}
                            className="absolute end-3 top-1/2 -translate-y-1/2 group-hover/menu-item:hidden"
                          >
                            {item.badge}
                          </Badge>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              mode="icon"
                              size="sm"
                              aria-label={
                                pinned
                                  ? `Bỏ ghim ${item.label}`
                                  : `Ghim ${item.label}`
                              }
                              aria-pressed={pinned}
                              onClick={() => togglePinnedMenu(menuKey)}
                              className={cn(
                                'absolute end-3 top-1/2 size-6 -translate-y-1/2 opacity-0 hover:bg-transparent hover:text-primary data-[state=open]:bg-transparent group-hover/menu-item:opacity-100',
                                isDark
                                  ? 'text-white/45'
                                  : 'text-muted-foreground',
                                pinned && 'text-primary',
                              )}
                            >
                              <Pin
                                className="size-4"
                                fill={pinned ? 'currentColor' : 'none'}
                              />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {pinned ? 'Bỏ ghim' : 'Ghim'}
                          </TooltipContent>
                        </Tooltip>
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
