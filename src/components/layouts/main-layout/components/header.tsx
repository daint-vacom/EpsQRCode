import { Fragment, useEffect, useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { signOutFromSupabase } from '@/features/auth/api/auth.api';
import { loadMyQrCodeAccount } from '@/project/accounts/api/accounts.api';
import type { MyQrCodeAccount } from '@/project/accounts/model/account';
import { GlobalSearch } from '@/project/search/components/global-search';
import { useAuthStore } from '@/stores/auth.store';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Building2,
  CircleHelp,
  LogOut,
  Menu,
  PackageCheck,
  Palette,
  PanelLeft,
  PanelLeftClose,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShoppingCart,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useIntl } from 'react-intl';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useLayout } from './context';
import { SidebarSecondary } from './sidebar-secondary';

const DISPLAY_THEMES = [
  { value: 'system', label: 'Theo hệ thống' },
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
] as const;

const MOCK_NOTIFICATIONS = [
  {
    title: 'Đơn hàng mới được tạo',
    description: 'Đơn hàng DH-2026-031 đang chờ xử lý.',
    time: '5 phút trước',
    icon: ShoppingCart,
    iconClassName: 'bg-admin-blue-bg text-admin-blue-primary',
    unread: true,
  },
  {
    title: 'Mẫu vật tư đã được cập nhật',
    description: 'Mẫu “Palang điện” vừa được cập nhật thông tin.',
    time: '1 giờ trước',
    icon: PackageCheck,
    iconClassName: 'bg-admin-success-bg text-admin-success-text',
    unread: true,
  },
  {
    title: 'Bảo trì hệ thống',
    description: 'Hệ thống sẽ bảo trì lúc 23:00 hôm nay.',
    time: 'Hôm qua',
    icon: ShieldAlert,
    iconClassName: 'bg-admin-amber-bg text-admin-amber-dark',
    unread: false,
  },
  {
    title: 'Đã cấp quyền truy cập',
    description: 'Bạn đã được cấp quyền quản lý danh mục thông số.',
    time: 'Hôm qua',
    icon: ShieldAlert,
    iconClassName: 'bg-admin-violet-bg text-admin-violet-dark',
    unread: false,
  },
  {
    title: 'Nhân viên mới được thêm',
    description: 'Nguyễn Minh Anh đã được thêm vào danh sách nhân sự.',
    time: '2 ngày trước',
    icon: UserRound,
    iconClassName: 'bg-admin-blue-bg text-admin-blue-primary',
    unread: false,
  },
  {
    title: 'Cập nhật danh mục vật tư',
    description: 'Có 4 vật tư mới được cập nhật trong hệ thống.',
    time: '3 ngày trước',
    icon: PackageCheck,
    iconClassName: 'bg-admin-success-bg text-admin-success-text',
    unread: false,
  },
  {
    title: 'Đơn hàng đã hoàn tất',
    description: 'Đơn hàng DH-2026-024 đã được xác nhận hoàn tất.',
    time: '4 ngày trước',
    icon: ShoppingCart,
    iconClassName: 'bg-admin-amber-bg text-admin-amber-dark',
    unread: false,
  },
  {
    title: 'Phiên đăng nhập mới',
    description: 'Tài khoản vừa đăng nhập trên thiết bị mới.',
    time: '5 ngày trước',
    icon: ShieldAlert,
    iconClassName: 'bg-admin-red-bg text-admin-red-dark',
    unread: false,
  },
] as const;

function AccountMenuHeader({
  name,
  email,
  roles,
}: {
  name: string;
  email: string;
  roles: MyQrCodeAccount['roles'];
}) {
  const initial = name.trim().charAt(0).toUpperCase() || 'T';

  return (
    <DropdownMenuLabel className="px-2 py-2">
      <div className="flex items-center gap-3">
        <Avatar className="size-9 rounded-full border border-admin-amber-light bg-gradient-to-br from-[#fff3e0] to-[#ffb74d] text-sm font-bold text-[#f57c00] shadow-sm">
          <AvatarFallback className="border-0 bg-transparent text-[#f57c00]">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {name}
          </p>
          {email ? (
            <p className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </p>
          ) : null}
        </div>
      </div>
      {roles.length ? (
        <div className="mt-2 flex flex-wrap gap-1 ps-12">
          {roles.map((role) => (
            <Badge
              key={`${role.name}-${role.color}`}
              variant={role.color}
              appearance="light"
              size="sm"
              className="max-w-full rounded-md"
            >
              <span className="truncate">{role.name}</span>
            </Badge>
          ))}
        </div>
      ) : null}
    </DropdownMenuLabel>
  );
}

function ReadonlyAccountOption({
  icon: Icon,
  label,
  description,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <DropdownMenuItem
      aria-disabled="true"
      onSelect={(event) => event.preventDefault()}
    >
      <Icon />
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate">{label}</span>
        <span className="break-words text-xs font-normal text-muted-foreground">
          {description}
        </span>
      </span>
    </DropdownMenuItem>
  );
}

export function Header() {
  const intl = useIntl();
  const { isMobile, isSidebarOpen, sidebarToggle, shell } = useLayout();
  const isDark = shell.headerVariant === 'dark';
  const isProjectShell = shell.homePath === ROUTES.HOME;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const { theme, setTheme } = useTheme();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] =
    useState(true);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const currentTheme =
    DISPLAY_THEMES.find((item) => item.value === theme) ?? DISPLAY_THEMES[0];
  const unreadNotificationCount = notifications.filter(
    (notification) => notification.unread,
  ).length;
  const accountName = authUser?.name || 'Tài khoản';
  const accountEmail = authUser?.email ?? '';
  const accountQuery = useQuery({
    queryKey: ['project', 'my-qrcode-account', authUser?.id ?? null],
    queryFn: () => loadMyQrCodeAccount(),
    enabled: isProjectShell && Boolean(authUser?.id),
  });
  const account = accountQuery.data;
  const accountUnitLabel =
    account?.accountType === 'external'
      ? intl.formatMessage({ id: 'accounts.fields.externalOrganization' })
      : account?.accountType === 'eps'
        ? intl.formatMessage({ id: 'accounts.settings.profile.department' })
        : intl.formatMessage({ id: 'settings.tabs.organization' });
  const accountUnitName =
    account?.accountType === 'external'
      ? account.externalOrganizationName
      : account?.accountType === 'eps'
        ? account.epsDepartmentName
        : null;
  const accountUnitValue = accountQuery.isPending
    ? intl.formatMessage({ id: 'common.state.loading' })
    : accountQuery.isError && !account
      ? intl.formatMessage({ id: 'accounts.settings.profile.error' })
      : (accountUnitName ??
        intl.formatMessage({
          id: account
            ? 'accounts.settings.profile.unmapped'
            : 'accounts.settings.profile.missing',
        }));
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || 'T';
  const breadcrumbItems = shell.breadcrumbItems ?? [
    { label: shell.breadcrumbRootLabel, path: shell.breadcrumbRootPath },
    { label: shell.breadcrumbCurrent },
  ];

  const handleLogout = async () => {
    try {
      if (token) await signOutFromSupabase();
    } finally {
      logout();
      navigate('/login', { replace: true });
    }
  };

  useEffect(() => {
    setIsSheetOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        'fixed end-0 start-0 top-0 z-10 flex h-(--header-height-mobile) shrink-0 items-center justify-between border-b px-3 transition-[inset-inline-start] duration-200 ease-out lg:h-(--header-height) lg:px-4',
        isDark
          ? 'border-admin-shell-border/70 bg-admin-shell-deep text-white'
          : 'border-border bg-card',
        'lg:start-[var(--sidebar-current-width)]',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {isMobile && (
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                mode="icon"
                size="sm"
                aria-label="Mở menu"
                className={
                  isDark
                    ? 'text-white/70 hover:bg-white/10 hover:text-white'
                    : undefined
                }
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              className="w-[280px] gap-0 p-0"
              side="left"
              close={false}
            >
              <SheetHeader className="p-0" />
              <SheetBody className="flex p-0">
                <SidebarSecondary />
              </SheetBody>
            </SheetContent>
          </Sheet>
        )}

        {!isMobile && (
          <Button
            variant="ghost"
            mode="icon"
            size="sm"
            aria-label={isSidebarOpen ? 'Thu gọn menu' : 'Mở rộng menu'}
            onClick={sidebarToggle}
            className={
              isDark
                ? 'text-white/70 hover:bg-white/10 hover:text-white'
                : undefined
            }
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeft className="size-4" />
            )}
          </Button>
        )}

        <div className="min-w-0 flex-1">
          {isProjectShell ? (
            <div
              className={cn(
                'truncate text-[13px] font-semibold leading-tight',
                isDark ? 'text-white' : 'text-foreground',
              )}
              title={shell.headerTitle}
            >
              {shell.headerTitle}
            </div>
          ) : null}
          <nav
            className={cn(
              'flex items-center gap-2 text-sm font-medium',
              isProjectShell && 'mt-0.5 gap-1.5 text-xs',
              isDark ? 'text-white/55' : 'text-muted-foreground',
            )}
          >
            {breadcrumbItems.map((item, index) => (
              <Fragment key={`${item.label}-${index}`}>
                {index > 0 && (
                  <span
                    className={
                      isDark ? 'text-white/35' : 'text-muted-foreground/60'
                    }
                  >
                    /
                  </span>
                )}
                {item.path ? (
                  <Link
                    to={item.path}
                    aria-label={
                      index === 0
                        ? isProjectShell
                          ? item.label
                          : shell.headerTitle
                        : undefined
                    }
                    title={
                      index === 0
                        ? isProjectShell
                          ? item.label
                          : shell.headerTitle
                        : undefined
                    }
                    className={cn(
                      'inline-flex items-center',
                      isDark ? 'hover:text-white' : 'hover:text-foreground',
                    )}
                  >
                    {index === 0 ? (
                      <span className="max-w-40 truncate sm:max-w-56">
                        {isProjectShell ? item.label : shell.headerTitle}
                      </span>
                    ) : (
                      item.label
                    )}
                  </Link>
                ) : (
                  <span className="inline-flex items-center">{item.label}</span>
                )}
              </Fragment>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <GlobalSearch />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              mode="icon"
              size="sm"
              className={cn(
                'relative',
                isDark && 'text-white/70 hover:bg-white/10 hover:text-white',
              )}
              aria-label="Mở thông báo"
            >
              <Bell className="size-4.5" />
              {unreadNotificationCount > 0 && (
                <Badge
                  variant="destructive"
                  size="xs"
                  shape="circle"
                  className="absolute -end-0.5 -top-0.5 size-4 min-w-4 p-0 text-[0.625rem] leading-none"
                >
                  {unreadNotificationCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={8}
            className="w-[22rem] overflow-hidden p-0"
          >
            <div className="max-h-80 overflow-y-auto p-2">
              <div className="space-y-1">
                {notifications.map((notification) => {
                  const Icon = notification.icon;

                  return (
                    <button
                      key={notification.title}
                      type="button"
                      className="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-field"
                    >
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${notification.iconClassName}`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="text-sm font-semibold text-foreground">
                            {notification.title}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {notification.time}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {notification.description}
                        </span>
                      </span>
                      {notification.unread && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
              <span className="text-xs text-muted-foreground">
                {unreadNotificationCount} tin chưa đọc
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-primary hover:text-primary"
                disabled={unreadNotificationCount === 0}
                onClick={() =>
                  setNotifications((current) =>
                    current.map((notification) => ({
                      ...notification,
                      unread: false,
                    })),
                  )
                }
              >
                Đánh dấu đã đọc tất cả
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg p-1 text-left outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                isDark ? 'hover:bg-white/10' : 'hover:bg-field',
              )}
              type="button"
              aria-label="Mở menu tài khoản"
            >
              <Avatar className="size-8 rounded-full border border-admin-amber-light bg-gradient-to-br from-[#fff3e0] to-[#ffb74d] text-sm font-bold text-[#f57c00] shadow-sm">
                <AvatarFallback className="border-0 bg-transparent text-[#f57c00]">
                  {accountInitial}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-left sm:block">
                <span
                  className={cn(
                    'block text-[13px] font-semibold leading-tight',
                    isDark ? 'text-white' : 'text-foreground',
                  )}
                >
                  {accountName}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className={cn('p-1.5', isProjectShell ? 'w-72' : 'w-64')}
          >
            <AccountMenuHeader
              name={accountName}
              email={accountEmail}
              roles={isProjectShell ? (accountQuery.data?.roles ?? []) : []}
            />

            {isProjectShell ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    {intl.formatMessage({ id: 'settings.tabs.account' })}
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={() =>
                      navigate(`${ROUTES.PROJECT.SETTINGS}?tab=account`)
                    }
                  >
                    <UserRound />
                    {intl.formatMessage({ id: 'settings.tabs.account' })}
                  </DropdownMenuItem>
                  <ReadonlyAccountOption
                    icon={Building2}
                    label={accountUnitValue}
                    description={accountUnitLabel}
                  />
                  {account?.accountType === 'eps' && account.epsTeamName ? (
                    <ReadonlyAccountOption
                      icon={UsersRound}
                      label={account.epsTeamName}
                      description={intl.formatMessage({
                        id: 'accounts.settings.profile.team',
                      })}
                    />
                  ) : null}
                  {accountQuery.isError && !accountQuery.data ? (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        void accountQuery.refetch();
                      }}
                    >
                      <RefreshCw />
                      {intl.formatMessage({ id: 'common.actions.refresh' })}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            ) : (
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Settings />
                  Cài đặt
                </DropdownMenuItem>
              </DropdownMenuGroup>
            )}

            {!isProjectShell ? <DropdownMenuSeparator /> : null}

            <DropdownMenuGroup>
              <DropdownMenuLabel>Tùy chọn</DropdownMenuLabel>
              {isProjectShell ? (
                <DropdownMenuItem
                  onSelect={() => navigate(ROUTES.PROJECT.SETTINGS)}
                >
                  <Settings />
                  Cài đặt
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette />
                  <span className="min-w-0 flex-1 truncate">Chủ đề</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {currentTheme.label}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  <DropdownMenuRadioGroup
                    value={theme ?? 'system'}
                    onValueChange={setTheme}
                  >
                    {DISPLAY_THEMES.map((item) => (
                      <DropdownMenuRadioItem
                        key={item.value}
                        value={item.value}
                        indicator="check"
                        indicatorPosition="end"
                      >
                        {item.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {!isProjectShell ? (
                <>
                  <DropdownMenuItem
                    className="justify-between"
                    onSelect={(event) => event.preventDefault()}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Bell />
                      <span className="truncate">Thông báo trên màn hình</span>
                    </span>
                    <Switch
                      size="sm"
                      checked={desktopNotificationsEnabled}
                      onCheckedChange={setDesktopNotificationsEnabled}
                    />
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem>
                <CircleHelp />
                Trợ giúp
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void handleLogout()}
            >
              <LogOut />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
