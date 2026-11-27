import { useMemo, useState } from 'react';
import { ClipboardCheck, Plus } from 'lucide-react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { PageLoading } from '@/components/ui/loading';
import { OptionSelect } from '@/components/ui/option-select';
import {
  useSafetyInspectionSchedulePreviewQuery,
  useSafetyInspectionTypeConfigsQuery,
  useSaveSafetyInspectionTypeConfigMutation,
} from '../hooks/use-safety-inspection-type-configs';
import type {
  SafetyInspectionConfigScope,
  SafetyInspectionTypeConfigView,
} from '../model/safety-inspection-type-config';
import { SafetyInspectionChecklistEditor } from './safety-inspection-checklist-editor';
import { SafetyInspectionTypeConfigDialog } from './safety-inspection-type-config-dialog.generated';
import { SafetyInspectionTypeConfigTable } from './safety-inspection-type-config-table';

interface ConfigDraft {
  name: string;
  inheritName: boolean;
  checklist: SafetyInspectionTypeConfigView['checklist'];
  checklistMode: 'replace' | 'append';
  inheritChecklist: boolean;
  intervalValue: string;
  intervalUnit: 'day' | 'month' | 'quarter';
  inheritInterval: boolean;
  enabled: boolean;
  inheritEnabled: boolean;
  startsOn: string;
  inheritStartsOn: boolean;
}

const EMPTY_CHECKLIST: NonNullable<ConfigDraft['checklist']> = [];

export interface SafetyInspectionTypeConfigsProps {
  scopeKind: SafetyInspectionConfigScope;
  scopeId: string;
  canManage?: boolean;
  readOnly?: boolean;
}

export function SafetyInspectionTypeConfigs({
  scopeKind,
  scopeId,
  canManage = true,
  readOnly = false,
}: SafetyInspectionTypeConfigsProps) {
  const intl = useIntl();
  const query = useSafetyInspectionTypeConfigsQuery(scopeKind, scopeId);
  const saveMutation = useSaveSafetyInspectionTypeConfigMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] =
    useState<SafetyInspectionTypeConfigView | null>(null);
  const [newTypeId, setNewTypeId] = useState<string | null>(null);
  const [recalculate, setRecalculate] = useState(false);
  const form = useForm<ConfigDraft>({
    defaultValues: {
      name: '',
      inheritName: false,
      checklist: EMPTY_CHECKLIST,
      checklistMode: 'replace',
      inheritChecklist: false,
      intervalValue: '1',
      intervalUnit: 'month',
      inheritInterval: false,
      enabled: true,
      inheritEnabled: false,
      startsOn: '',
      inheritStartsOn: false,
    },
  });
  const intervalUnitOptions = useMemo(
    () =>
      (['day', 'month', 'quarter'] as const).map((unit) => ({
        value: unit,
        label: intl.formatMessage({
          id: `project.materials.safetyInspection.typeConfig.units.${unit}`,
        }),
      })),
    [intl],
  );
  const watchedIntervalValue = useWatch({
    control: form.control,
    name: 'intervalValue',
  });
  const watchedIntervalUnit = useWatch({
    control: form.control,
    name: 'intervalUnit',
  });
  const watchedInheritInterval = useWatch({
    control: form.control,
    name: 'inheritInterval',
  });
  const watchedEnabled = useWatch({ control: form.control, name: 'enabled' });
  const watchedInheritEnabled = useWatch({
    control: form.control,
    name: 'inheritEnabled',
  });
  const inheritedMaterialChecklist =
    scopeKind === 'material' && editingType?.hasParent;
  const canRecalculate = Boolean(
    editingType?.enabled &&
    !watchedInheritInterval &&
    watchedEnabled &&
    (!watchedInheritEnabled || editingType.directConfig?.enabled == null),
  );
  const shouldRecalculate = recalculate && canRecalculate;
  const previewIntervalValue = Number(watchedIntervalValue);
  const previewQuery = useSafetyInspectionSchedulePreviewQuery(
    scopeKind,
    scopeId,
    editingType?.typeId ?? null,
    Number.isInteger(previewIntervalValue) && previewIntervalValue > 0
      ? previewIntervalValue
      : null,
    watchedIntervalUnit,
    shouldRecalculate,
  );

  const openNew = () => {
    setRecalculate(false);
    const typeId = crypto.randomUUID();
    setEditingType(null);
    setNewTypeId(typeId);
    form.reset({
      name: '',
      inheritName: false,
      checklist: [],
      checklistMode: 'replace',
      inheritChecklist: false,
      intervalValue: '1',
      intervalUnit: 'month',
      inheritInterval: false,
      enabled: true,
      inheritEnabled: false,
      startsOn: new Date().toISOString().slice(0, 10),
      inheritStartsOn: false,
    });
    setDialogOpen(true);
  };

  const openEdit = (type: SafetyInspectionTypeConfigView) => {
    setRecalculate(false);
    const direct = type.directConfig;
    setEditingType(type);
    setNewTypeId(null);
    form.reset({
      name: direct?.nameOverride ?? type.typeName,
      inheritName: direct?.nameOverride == null && type.hasParent,
      checklist: direct?.checklist ?? type.checklist ?? EMPTY_CHECKLIST,
      checklistMode: direct?.checklistMode ?? 'replace',
      inheritChecklist: direct?.checklist == null && type.hasParent,
      intervalValue: String(direct?.intervalValue ?? type.intervalValue ?? 1),
      intervalUnit: direct?.intervalUnit ?? type.intervalUnit ?? 'month',
      inheritInterval: direct?.intervalValue == null && type.hasParent,
      enabled: direct?.enabled ?? type.enabled,
      inheritEnabled: direct?.enabled == null && type.hasParent,
      startsOn: direct?.startsOn ?? type.startsOn ?? '',
      inheritStartsOn: direct?.startsOn == null && type.hasParent,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saveMutation.isPending) return;
    setDialogOpen(false);
    setEditingType(null);
    setNewTypeId(null);
    setRecalculate(false);
    saveMutation.reset();
  };

  const save = async () => {
    const draft = form.getValues();
    const typeId = newTypeId ?? editingType?.typeId;
    if (!typeId) return;
    const name = draft.inheritName ? null : draft.name.trim();
    if (!name && !editingType) {
      form.setError('name', {
        type: 'required',
        message: intl.formatMessage({
          id: 'project.materials.safetyInspection.typeConfig.validation.name',
        }),
      });
      return;
    }
    const intervalValue = draft.inheritInterval
      ? null
      : Number(draft.intervalValue);
    if (
      !draft.inheritInterval &&
      (!Number.isInteger(intervalValue) || (intervalValue ?? 0) < 1)
    ) {
      form.setError('intervalValue', {
        type: 'validate',
        message: intl.formatMessage({
          id: 'project.materials.safetyInspection.typeConfig.validation.interval',
        }),
      });
      return;
    }
    if (
      !inheritedMaterialChecklist &&
      !draft.inheritChecklist &&
      (!draft.checklist?.length ||
        draft.checklist.some((group) => group.criteria.length === 0))
    ) {
      return;
    }
    if (shouldRecalculate && !previewQuery.data?.token) return;
    try {
      await saveMutation.mutateAsync({
        scopeKind,
        scopeId,
        typeId,
        name: name ?? null,
        checklist: inheritedMaterialChecklist
          ? (editingType?.directConfig?.checklist ?? null)
          : draft.inheritChecklist
            ? null
            : draft.checklist,
        checklistMode: draft.checklistMode,
        intervalValue,
        intervalUnit: draft.inheritInterval ? null : draft.intervalUnit,
        enabled: draft.inheritEnabled ? null : draft.enabled,
        startsOn: draft.inheritStartsOn ? null : draft.startsOn || null,
        recalculate: shouldRecalculate,
        expectedPreviewToken: shouldRecalculate
          ? (previewQuery.data?.token ?? null)
          : null,
      });
    } catch {
      return;
    }
    setDialogOpen(false);
    setEditingType(null);
    setNewTypeId(null);
    setRecalculate(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle>
              {intl.formatMessage({
                id: 'project.materials.safetyInspection.typeConfig.title',
              })}
            </CardTitle>
            <CardDescription>
              {intl.formatMessage({
                id: 'project.materials.safetyInspection.type',
              })}
            </CardDescription>
          </div>
          {canManage && !readOnly ? (
            <Button type="button" size="md" onClick={openNew}>
              <Plus />
              {intl.formatMessage({
                id: 'project.materials.safetyInspection.typeConfig.add',
              })}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {query.isPending ? (
            <PageLoading
              label={intl.formatMessage({ id: 'common.state.loading' })}
            />
          ) : query.isError ? (
            <ErrorState
              title={intl.formatMessage({
                id: 'project.materials.errors.loadDetailTitle',
              })}
              description={getApiErrorMessage(query.error)}
              onRetry={() => void query.refetch()}
            />
          ) : !query.data?.length ? (
            <EmptyState
              icon={ClipboardCheck}
              title={intl.formatMessage({
                id: 'project.materials.safetyInspection.typeConfig.empty',
              })}
              className="min-h-28"
            />
          ) : (
            <SafetyInspectionTypeConfigTable
              items={query.data}
              onEdit={canManage && !readOnly ? openEdit : undefined}
            />
          )}
        </CardContent>
      </Card>

      <SafetyInspectionTypeConfigDialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        onCancel={closeDialog}
        onSave={() => void save()}
        isSaving={saveMutation.isPending}
      >
        <FormProvider {...form}>
          <div className="space-y-4">
            {saveMutation.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.materials.safetyInspection.typeConfig.errors.saveTitle',
                })}
                description={getApiErrorMessage(saveMutation.error)}
                className="py-2"
              />
            ) : null}
            <FormField
              control={form.control}
              name="inheritName"
              render={({ field: inheritField }) => (
                <FormItem layout="horizontal" labelWidth="md">
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'project.materials.fields.name',
                    })}
                  </FormLabel>
                  <div className="flex min-w-0 items-center gap-3">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormControl>
                          <Input
                            {...field}
                            disabled={inheritField.value}
                            aria-label={intl.formatMessage({
                              id: 'project.materials.fields.name',
                            })}
                          />
                        </FormControl>
                      )}
                    />
                    {editingType?.hasParent ? (
                      <label className="flex shrink-0 items-center gap-2 text-sm">
                        <Checkbox
                          checked={inheritField.value}
                          onCheckedChange={inheritField.onChange}
                        />
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.typeConfig.inherit',
                        })}
                      </label>
                    ) : null}
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="inheritInterval"
              render={({ field: inheritField }) => (
                <FormItem layout="horizontal" labelWidth="md">
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'project.materials.safetyInspection.typeConfig.interval',
                    })}
                  </FormLabel>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_12rem] gap-2">
                      <FormField
                        control={form.control}
                        name="intervalValue"
                        render={({ field }) => (
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={1}
                              disabled={inheritField.value}
                              aria-label={intl.formatMessage({
                                id: 'project.materials.safetyInspection.typeConfig.interval',
                              })}
                            />
                          </FormControl>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="intervalUnit"
                        render={({ field }) => (
                          <FormControl>
                            <OptionSelect
                              options={intervalUnitOptions}
                              value={field.value}
                              onChange={(value) =>
                                field.onChange(value ?? 'month')
                              }
                              disabled={inheritField.value}
                              aria-label={intl.formatMessage({
                                id: 'project.materials.safetyInspection.typeConfig.interval',
                              })}
                            />
                          </FormControl>
                        )}
                      />
                    </div>
                    {editingType?.hasParent ? (
                      <label className="flex shrink-0 items-center gap-2 text-sm">
                        <Checkbox
                          checked={inheritField.value}
                          onCheckedChange={(checked) => {
                            inheritField.onChange(checked);
                            if (checked === true) setRecalculate(false);
                          }}
                        />
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.typeConfig.inherit',
                        })}
                      </label>
                    ) : null}
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="inheritEnabled"
              render={({ field: inheritField }) => (
                <FormItem layout="horizontal" labelWidth="md">
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'project.materials.safetyInspection.typeConfig.enabled',
                    })}
                  </FormLabel>
                  <div className="flex items-center gap-3">
                    <FormField
                      control={form.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (checked !== true) setRecalculate(false);
                            }}
                            disabled={inheritField.value}
                          />
                        </FormControl>
                      )}
                    />
                    {editingType?.hasParent ? (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={inheritField.value}
                          onCheckedChange={(checked) => {
                            inheritField.onChange(checked);
                            if (checked === true) setRecalculate(false);
                          }}
                        />
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.typeConfig.inherit',
                        })}
                      </label>
                    ) : null}
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="inheritStartsOn"
              render={({ field: inheritField }) => (
                <FormItem layout="horizontal" labelWidth="md">
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'project.materials.safetyInspection.typeConfig.startsOn',
                    })}
                  </FormLabel>
                  <div className="flex items-center gap-3">
                    <FormField
                      control={form.control}
                      name="startsOn"
                      render={({ field }) => (
                        <FormControl>
                          <DatePickerInput
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            disabled={inheritField.value}
                            calendarLabel={intl.formatMessage({
                              id: 'project.materials.safetyInspection.typeConfig.startsOn',
                            })}
                            valueMode="iso-date"
                            variant="md"
                          />
                        </FormControl>
                      )}
                    />
                    {editingType?.hasParent ? (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={inheritField.value}
                          onCheckedChange={inheritField.onChange}
                        />
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.typeConfig.inherit',
                        })}
                      </label>
                    ) : null}
                  </div>
                </FormItem>
              )}
            />
            {canRecalculate ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={recalculate}
                    onCheckedChange={(checked) =>
                      setRecalculate(checked === true)
                    }
                  />
                  {intl.formatMessage({
                    id: 'project.materials.safetyInspection.typeConfig.recalculate',
                  })}
                </label>
                {recalculate ? (
                  previewQuery.isPending ? (
                    <PageLoading
                      label={intl.formatMessage({
                        id: 'common.state.loading',
                      })}
                    />
                  ) : previewQuery.isError ? (
                    <ErrorState
                      title={intl.formatMessage({
                        id: 'project.materials.safetyInspection.typeConfig.previewError',
                      })}
                      description={getApiErrorMessage(previewQuery.error)}
                      onRetry={() => void previewQuery.refetch()}
                    />
                  ) : previewQuery.data ? (
                    <div className="space-y-2 rounded-md border p-3">
                      <p className="text-sm">
                        {intl.formatMessage(
                          {
                            id: 'project.materials.safetyInspection.typeConfig.previewCount',
                          },
                          { count: previewQuery.data.total },
                        )}
                      </p>
                      {previewQuery.data.items.length ? (
                        <div className="max-h-48 space-y-2 overflow-y-auto">
                          {previewQuery.data.items.map((item) => (
                            <div
                              key={item.materialId}
                              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm"
                            >
                              <span className="min-w-0 truncate">
                                {item.name}{' '}
                                <span className="text-muted-foreground">
                                  ({item.code})
                                </span>
                              </span>
                              <span className="shrink-0 text-muted-foreground">
                                {item.oldDueDate ?? '—'} → {item.newDueDate}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null
                ) : null}
              </div>
            ) : null}
            <FormField
              control={form.control}
              name="inheritChecklist"
              render={({ field: inheritField }) => (
                <FormItem layout="horizontal" labelWidth="md" alignment="start">
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'project.materials.safetyInspection.typeConfig.checklist',
                    })}
                  </FormLabel>
                  <div className="min-w-0 space-y-3">
                    {!inheritedMaterialChecklist && editingType?.hasParent ? (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={inheritField.value}
                          onCheckedChange={inheritField.onChange}
                        />
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.typeConfig.inherit',
                        })}
                      </label>
                    ) : null}
                    <fieldset
                      disabled={
                        inheritedMaterialChecklist || inheritField.value
                      }
                      className="min-w-0"
                    >
                      <FormField
                        control={form.control}
                        name="checklist"
                        render={({ field }) => (
                          <SafetyInspectionChecklistEditor
                            groups={field.value ?? EMPTY_CHECKLIST}
                            onChange={field.onChange}
                            showCount
                          />
                        )}
                      />
                    </fieldset>
                  </div>
                </FormItem>
              )}
            />
            {scopeKind === 'model' ? (
              <FormField
                control={form.control}
                name="checklistMode"
                render={({ field }) => (
                  <FormItem layout="horizontal" labelWidth="md">
                    <FormLabel>
                      {intl.formatMessage({
                        id: 'project.materials.safetyInspection.typeConfig.checklist',
                      })}
                    </FormLabel>
                    <FormControl>
                      <OptionSelect
                        options={[
                          {
                            value: 'replace',
                            label: intl.formatMessage({
                              id: 'project.materials.safetyInspection.typeConfig.checklistMode.replace',
                            }),
                          },
                          {
                            value: 'append',
                            label: intl.formatMessage({
                              id: 'project.materials.safetyInspection.typeConfig.checklistMode.append',
                            }),
                          },
                        ]}
                        value={field.value}
                        onChange={(value) => field.onChange(value ?? 'replace')}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            ) : null}
          </div>
        </FormProvider>
      </SafetyInspectionTypeConfigDialog>
    </>
  );
}
