import type { ReactNode } from 'react';
import { Palette, Settings, type LucideIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useIntl } from 'react-intl';
import {
  useAppSettings,
  type AppDensity,
  type AppSidebarTheme,
  type AppTheme,
} from '@/providers/app-settings-provider';
import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export function ProjectSettingsPage() {
  const intl = useIntl();
  const { theme, setTheme } = useTheme();
  const { appearance, saveAppearance } = useAppSettings();
  const currentTheme = theme === 'light' || theme === 'dark' ? theme : 'system';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-4 lg:px-5 lg:pt-5">
        <PageHeader
          title={intl.formatMessage({ id: 'settings.page.title' })}
          icon={Settings}
        />
      </div>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="h-full">
        <div className="min-w-0 space-y-3 px-4 pb-4 pt-4 lg:space-y-4 lg:px-5 lg:pb-5 lg:pt-5">
          <SettingsSection
            icon={Palette}
            title={intl.formatMessage({ id: 'settings.appearance.title' })}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <SettingsField
                label={intl.formatMessage({
                  id: 'settings.appearance.fields.theme',
                })}
              >
                <Select
                  value={currentTheme}
                  onValueChange={(value) => {
                    if (
                      value === 'system' ||
                      value === 'light' ||
                      value === 'dark'
                    ) {
                      setTheme(value);
                      saveAppearance({
                        ...appearance,
                        theme: value as AppTheme,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">
                      {intl.formatMessage({
                        id: 'settings.appearance.theme.system',
                      })}
                    </SelectItem>
                    <SelectItem value="light">
                      {intl.formatMessage({
                        id: 'settings.appearance.theme.light',
                      })}
                    </SelectItem>
                    <SelectItem value="dark">
                      {intl.formatMessage({
                        id: 'settings.appearance.theme.dark',
                      })}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>
              <SettingsField
                label={intl.formatMessage({
                  id: 'settings.appearance.fields.density',
                })}
              >
                <Select
                  value={appearance.density}
                  onValueChange={(value) => {
                    if (
                      value === 'small' ||
                      value === 'medium' ||
                      value === 'large'
                    ) {
                      saveAppearance({
                        ...appearance,
                        density: value as AppDensity,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">
                      {intl.formatMessage({
                        id: 'settings.appearance.density.small',
                      })}
                    </SelectItem>
                    <SelectItem value="medium">
                      {intl.formatMessage({
                        id: 'settings.appearance.density.medium',
                      })}
                    </SelectItem>
                    <SelectItem value="large">
                      {intl.formatMessage({
                        id: 'settings.appearance.density.large',
                      })}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>
              <SettingsField
                label={intl.formatMessage({
                  id: 'settings.appearance.fields.sidebarTheme',
                })}
              >
                <Select
                  value={appearance.sidebarTheme}
                  onValueChange={(value) => {
                    if (value === 'light' || value === 'dark') {
                      saveAppearance({
                        ...appearance,
                        sidebarTheme: value as AppSidebarTheme,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      {intl.formatMessage({
                        id: 'settings.appearance.theme.light',
                      })}
                    </SelectItem>
                    <SelectItem value="dark">
                      {intl.formatMessage({
                        id: 'settings.appearance.theme.dark',
                      })}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <label className="flex items-center justify-between gap-4">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {intl.formatMessage({
                      id: 'settings.appearance.autoCollapse.title',
                    })}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {intl.formatMessage({
                      id: 'settings.appearance.autoCollapse.description',
                    })}
                  </span>
                </span>
                <Switch
                  checked={appearance.autoCollapseSidebarOnDetail}
                  onCheckedChange={(checked) =>
                    saveAppearance({
                      ...appearance,
                      autoCollapseSidebarOnDetail: checked,
                    })
                  }
                  aria-label={intl.formatMessage({
                    id: 'settings.appearance.autoCollapse.title',
                  })}
                />
              </label>
            </div>
          </SettingsSection>
        </div>
      </ScrollArea>
    </div>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="p-5">
        <CardHeading>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="size-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeading>
      </CardHeader>
      <CardContent className="space-y-5 p-5">{children}</CardContent>
    </Card>
  );
}

function SettingsField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
