import { Fragment, useEffect, useState } from 'react';
import { signOutFromSupabase } from '@/features/auth/api/auth.api';
import { GlobalSearch } from '@/project/search/components/global-search';
import { useAuthStore } from '@/stores/auth.store';
import {
  Bell,
  Building2,
  CircleHelp,
  Home,
  Languages,
  LogOut,
  Menu,
  PackageCheck,
  Palette,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Settings,
  ShieldAlert,
  ShoppingCart,
  UserRound,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toAbsoluteUrl } from '@/lib/helpers';
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
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLayout } from './context';
import { SidebarPrimary } from './sidebar-primary';
import { SidebarSecondary } from './sidebar-secondary';

const DISPLAY_LANGUAGES = [
  {
    code: 'vi',
    label: 'Tiếng Việt',
    flag: toAbsoluteUrl('/media/flags/vietnam.svg'),
  },
  {
    code: 'en',
    label: 'English',
    flag: toAbsoluteUrl('/media/flags/united-states.svg'),
  },
] as const;

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
    description: 'Nguyễn Minh Anh đã được thêm vào tổ chức.',
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

function AccountMenuHeader({ name, email }: { name: string; email: string }) {
  return (
    <>
      <DropdownMenuLabel className="px-2 py-1.5">
        <div className="flex items-center gap-3">
          <Avatar className="size-8 rounded-full border border-admin-amber-light bg-gradient-to-br from-[#fff3e0] to-[#ffb74d] text-sm font-bold text-[#f57c00] shadow-sm">
            <AvatarFallback className="border-0 bg-transparent text-[#f57c00]">
              T
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {name}
            </p>
            <p className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </p>
          </div>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
    </>
  );
}

export function Header() {
  const { isMobile, isSidebarOpen, sidebarToggle, shell } = useLayout();
  const isDark = shell.headerVariant === 'dark';
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { theme, setTheme } = useTheme();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [language, setLanguage] = useState('vi');
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] =
    useState(true);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const currentLanguage =
    DISPLAY_LANGUAGES.find((item) => item.code === language) ??
    DISPLAY_LANGUAGES[0];
  const currentTheme =
    DISPLAY_THEMES.find((item) => item.value === theme) ?? DISPLAY_THEMES[0];
  const unreadNotificationCount = notifications.filter(
    (notification) => notification.unread,
  ).length;
  const accountName = authUser?.name ?? 'Thanh Hiếu';
  const accountEmail = authUser?.email ?? 'thanh.hieu@admin.vn';
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || 'T';
  const breadcrumbItems = shell.breadcrumbItems ?? [
    { label: shell.breadcrumbRootLabel, path: shell.breadcrumbRootPath },
    { label: shell.breadcrumbCurrent },
  ];
  const quickCreateItems = shell.quickCreateItems ?? [];

  const handleLogout = async () => {
    try {
      await signOutFromSupabase();
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
                <SidebarPrimary />
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
          <nav
            className={cn(
              'flex items-center gap-2 text-sm font-medium',
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
                    aria-label={index === 0 ? shell.headerTitle : undefined}
                    title={index === 0 ? shell.headerTitle : undefined}
                    className={cn(
                      'inline-flex items-center',
                      isDark ? 'hover:text-white' : 'hover:text-foreground',
                    )}
                  >
                    {index === 0 ? (
                      <>
                        <Home className="me-1.5 size-4" aria-hidden="true" />
                        <span className="max-w-40 truncate sm:max-w-56">
                          {shell.headerTitle}
                        </span>
                      </>
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
        <Separator
          orientation="vertical"
          className={cn('h-6', isDark && 'bg-white/15')}
        />
        {quickCreateItems.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="light" size="md" aria-label="Thêm">
                <Plus />
                Thêm
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuGroup>
                {quickCreateItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <DropdownMenuItem
                      key={item.id}
                      onSelect={() => item.onSelect()}
                    >
                      <Icon />
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="light" size="md" aria-label="Thêm">
            <Plus />
            Thêm
          </Button>
        )}
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

        <Separator
          orientation="vertical"
          className={cn('h-6', isDark && 'bg-white/15')}
        />

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
                <span className="mt-0.5 flex max-w-48 items-center gap-1 overflow-hidden">
                  {shell.accountRoles.map((role) => (
                    <Badge
                      key={role}
                      variant="secondary"
                      appearance="light"
                      size="xs"
                      className={cn(
                        'max-w-24 truncate border font-semibold',
                        isDark
                          ? 'border-white/15 bg-white/10 text-white/70'
                          : 'border-admin-blue-light',
                      )}
                    >
                      {role}
                    </Badge>
                  ))}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-64 p-1.5"
          >
            <AccountMenuHeader name={accountName} email={accountEmail} />

            <DropdownMenuGroup>
              <DropdownMenuLabel>Tài khoản</DropdownMenuLabel>
              <DropdownMenuItem>
                <UserRound />
                <span className="min-w-0 flex-1">Tài khoản</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="destructive"
                      size="xs"
                      shape="circle"
                      className="size-4 min-w-4 shrink-0 px-0 text-[0.625rem]"
                    >
                      !
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent variant="destructive">
                    Cần cập nhật thông tin tài khoản
                  </TooltipContent>
                </Tooltip>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings />
                Cài đặt
              </DropdownMenuItem>
              <DropdownMenuItem className="items-start py-2">
                <Building2 className="mt-0.5" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span>Tổ chức</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    Công ty TNHH Vacom
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuLabel>Tùy chọn</DropdownMenuLabel>
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
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Languages />
                  <span className="min-w-0 flex-1 truncate">Ngôn ngữ</span>
                  <img
                    src={currentLanguage.flag}
                    alt={currentLanguage.label}
                    className="h-3.5 w-5 shrink-0 rounded-sm object-cover"
                  />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  <DropdownMenuRadioGroup
                    value={language}
                    onValueChange={setLanguage}
                  >
                    {DISPLAY_LANGUAGES.map((item) => (
                      <DropdownMenuRadioItem
                        key={item.code}
                        value={item.code}
                        indicator="check"
                        indicatorPosition="end"
                        className="gap-2"
                      >
                        <img
                          src={item.flag}
                          alt={item.label}
                          className="h-3.5 w-5 rounded-sm object-cover"
                        />
                        {item.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
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
