import { useEffect, useState, type ReactNode } from 'react';
import { AccountSettings } from '@/features/users/components/account-settings';
import type { CodeGenerationEntityKey } from '@/project/code-generation/api/code-generation-patterns.api';
import {
  useCodeGenerationPatternsQuery,
  useSaveCodeGenerationPatternsMutation,
} from '@/project/code-generation/hooks/use-code-generation-patterns';
import { getCodePatternExample } from '@/project/code-generation/model/code-pattern-example';
import {
  Database,
  Palette,
  Save,
  Settings,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useIntl } from 'react-intl';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import {
  useAppSettings,
  type AppDensity,
  type AppSidebarTheme,
  type AppTheme,
} from '@/providers/app-settings-provider';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/ui/loading';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SettingsTab = 'account' | 'data' | 'appearance';

function resolveSettingsTab(
  value: string | null,
  canViewDataConfiguration: boolean,
): SettingsTab {
  if (value === 'account' || value === 'appearance') return value;
  if (value === 'data' && canViewDataConfiguration) return value;
  return canViewDataConfiguration ? 'data' : 'appearance';
}

export function ProjectSettingsPage() {
  const intl = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useUser();
  const { theme, setTheme } = useTheme();
  const { appearance, saveAppearance } = useAppSettings();
  const canManageDataConfiguration = hasPermission(
    'organization:custom-field:update',
  );
  const canViewDataConfiguration =
    hasPermission('organization:custom-field:view') ||
    canManageDataConfiguration;
  const codePatternsQuery = useCodeGenerationPatternsQuery(
    canViewDataConfiguration,
  );
  const saveCodePatternsMutation = useSaveCodeGenerationPatternsMutation();
  const requestedTab = searchParams.get('tab');
  const [patternDrafts, setPatternDrafts] = useState<
    Record<CodeGenerationEntityKey, string>
  >({ material_group: '', material_model: '', material_specification: '' });
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    resolveSettingsTab(requestedTab, canViewDataConfiguration),
  );
  const currentTheme = theme === 'light' || theme === 'dark' ? theme : 'system';

  useEffect(() => {
    if (!codePatternsQuery.data) return;
    setPatternDrafts({
      material_group:
        codePatternsQuery.data.find(
          (pattern) => pattern.entityKey === 'material_group',
        )?.pattern ?? '',
      material_model:
        codePatternsQuery.data.find(
          (pattern) => pattern.entityKey === 'material_model',
        )?.pattern ?? '',
      material_specification:
        codePatternsQuery.data.find(
          (pattern) => pattern.entityKey === 'material_specification',
        )?.pattern ?? '',
    });
  }, [codePatternsQuery.data]);

  const savePatterns = () => {
    saveCodePatternsMutation.mutate(
      [
        { entityKey: 'material_group', pattern: patternDrafts.material_group },
        { entityKey: 'material_model', pattern: patternDrafts.material_model },
        {
          entityKey: 'material_specification',
          pattern: patternDrafts.material_specification,
        },
      ],
      {
        onSuccess: () =>
          toast.success(
            intl.formatMessage({ id: 'settings.dataConfiguration.saved' }),
          ),
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  useEffect(() => {
    setActiveTab(resolveSettingsTab(requestedTab, canViewDataConfiguration));
  }, [canViewDataConfiguration, requestedTab]);

  const handleTabChange = (value: string) => {
    const nextTab = resolveSettingsTab(value, canViewDataConfiguration);
    setActiveTab(nextTab);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('tab', nextTab);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-4 lg:px-5 lg:pt-5">
        <PageHeader
          title={intl.formatMessage({ id: 'settings.page.title' })}
          icon={Settings}
        />
      </div>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="h-full">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="min-w-0 px-4 pb-4 pt-4 lg:px-5 lg:pb-5 lg:pt-5"
        >
          <div className="grid min-w-0 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6">
            <TabsList
              variant="button"
              className="h-fit w-full flex-col items-stretch justify-start gap-1 rounded-lg border border-border bg-card p-2"
            >
              <TabsTrigger
                value="account"
                className="justify-start gap-2.5 px-3 text-left"
              >
                <UserRound />
                {intl.formatMessage({ id: 'settings.tabs.account' })}
              </TabsTrigger>
              {canViewDataConfiguration && (
                <TabsTrigger
                  value="data"
                  className="justify-start gap-2.5 px-3 text-left"
                >
                  <Database />
                  {intl.formatMessage({
                    id: 'settings.tabs.dataConfiguration',
                  })}
                </TabsTrigger>
              )}
              <TabsTrigger
                value="appearance"
                className="justify-start gap-2.5 px-3 text-left"
              >
                <Palette />
                {intl.formatMessage({ id: 'settings.tabs.appearance' })}
              </TabsTrigger>
            </TabsList>

            <div className="min-w-0">
              <TabsContent value="account" className="mt-0">
                <AccountSettings />
              </TabsContent>
              {canViewDataConfiguration && (
                <TabsContent value="data" className="mt-0">
                  <SettingsSection
                    icon={Database}
                    title={intl.formatMessage({
                      id: 'settings.dataConfiguration.title',
                    })}
                  >
                    {codePatternsQuery.isPending ? (
                      <PageLoading
                        label={intl.formatMessage({
                          id: 'common.state.loading',
                        })}
                      />
                    ) : codePatternsQuery.isError ? (
                      <ErrorState
                        title={intl.formatMessage({
                          id: 'settings.dataConfiguration.loadErrorTitle',
                        })}
                        description={getApiErrorMessage(
                          codePatternsQuery.error,
                        )}
                        onRetry={() => void codePatternsQuery.refetch()}
                      />
                    ) : (
                      <div className="space-y-4">
                        <div
                          role="note"
                          className="space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm"
                        >
                          <p className="font-medium text-foreground">
                            {intl.formatMessage({
                              id: 'settings.dataConfiguration.rules.title',
                            })}
                          </p>
                          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                            <li>
                              {intl.formatMessage({
                                id: 'settings.dataConfiguration.rules.literal',
                              })}
                            </li>
                            <li>
                              {intl.formatMessage({
                                id: 'settings.dataConfiguration.rules.sequence',
                              })}
                            </li>
                            <li>
                              {intl.formatMessage({
                                id: 'settings.dataConfiguration.rules.date',
                              })}
                            </li>
                            <li>
                              {intl.formatMessage({
                                id: 'settings.dataConfiguration.rules.uniqueness',
                              })}
                            </li>
                          </ul>
                        </div>
                        <SettingsField
                          label={intl.formatMessage({
                            id: 'settings.dataConfiguration.fields.materialGroupPattern',
                          })}
                        >
                          <Input
                            aria-label={intl.formatMessage({
                              id: 'settings.dataConfiguration.fields.materialGroupPattern',
                            })}
                            value={patternDrafts.material_group}
                            disabled={!canManageDataConfiguration}
                            onChange={(event) =>
                              setPatternDrafts((current) => ({
                                ...current,
                                material_group: event.target.value,
                              }))
                            }
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {intl.formatMessage(
                              {
                                id: 'settings.dataConfiguration.patternExample',
                              },
                              {
                                example: getCodePatternExample(
                                  patternDrafts.material_group,
                                ),
                              },
                            )}
                          </p>
                        </SettingsField>
                        <SettingsField
                          label={intl.formatMessage({
                            id: 'settings.dataConfiguration.fields.materialModelPattern',
                          })}
                        >
                          <Input
                            aria-label={intl.formatMessage({
                              id: 'settings.dataConfiguration.fields.materialModelPattern',
                            })}
                            value={patternDrafts.material_model}
                            disabled={!canManageDataConfiguration}
                            onChange={(event) =>
                              setPatternDrafts((current) => ({
                                ...current,
                                material_model: event.target.value,
                              }))
                            }
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {intl.formatMessage(
                              {
                                id: 'settings.dataConfiguration.patternExample',
                              },
                              {
                                example: getCodePatternExample(
                                  patternDrafts.material_model,
                                ),
                              },
                            )}
                          </p>
                        </SettingsField>
                        <SettingsField
                          label={intl.formatMessage({
                            id: 'settings.dataConfiguration.fields.materialSpecificationPattern',
                          })}
                        >
                          <Input
                            aria-label={intl.formatMessage({
                              id: 'settings.dataConfiguration.fields.materialSpecificationPattern',
                            })}
                            value={patternDrafts.material_specification}
                            disabled={!canManageDataConfiguration}
                            onChange={(event) =>
                              setPatternDrafts((current) => ({
                                ...current,
                                material_specification: event.target.value,
                              }))
                            }
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {intl.formatMessage(
                              {
                                id: 'settings.dataConfiguration.patternExample',
                              },
                              {
                                example: getCodePatternExample(
                                  patternDrafts.material_specification,
                                ),
                              },
                            )}
                          </p>
                        </SettingsField>
                        {canManageDataConfiguration && (
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="md"
                              loading={saveCodePatternsMutation.isPending}
                              loadingText={intl.formatMessage({
                                id: 'common.state.saving',
                              })}
                              onClick={savePatterns}
                            >
                              <Save />
                              {intl.formatMessage({
                                id: 'common.actions.save',
                              })}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </SettingsSection>
                </TabsContent>
              )}

              <TabsContent value="appearance" className="mt-0">
                <SettingsSection
                  icon={Palette}
                  title={intl.formatMessage({
                    id: 'settings.appearance.title',
                  })}
                >
                  <div className="space-y-4">
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
                          if (
                            value === 'theme' ||
                            value === 'light' ||
                            value === 'dark'
                          ) {
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
                          <SelectItem value="theme">
                            {intl.formatMessage({
                              id: 'settings.appearance.sidebarTheme.followTheme',
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
                        id: 'settings.appearance.autoCollapse.title',
                      })}
                    >
                      <div className="space-y-2">
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
                        <p className="text-xs text-muted-foreground">
                          {intl.formatMessage({
                            id: 'settings.appearance.autoCollapse.description',
                          })}
                        </p>
                      </div>
                    </SettingsField>
                  </div>
                </SettingsSection>
              </TabsContent>
            </div>
          </div>
        </Tabs>
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
    <div className="grid items-start gap-x-4 gap-y-1 md:grid-cols-[12rem_minmax(0,1fr)]">
      <Label className="pt-2 text-sm font-medium text-foreground">
        {label}
      </Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
