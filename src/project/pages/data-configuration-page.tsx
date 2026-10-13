import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, ListTree, Save, Trash2, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useIntl, type IntlShape } from 'react-intl';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PROJECT_ENTITY_ORDER } from '@/config/project-menu.config';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageLoading } from '@/components/ui/loading';
import { PageHeader } from '@/components/ui/page-header';
import {
  loadCustomFields,
  saveCustomFields,
} from '../data-configuration/api/custom-fields.api';
import { CustomFieldOptionsDialogShell } from '../data-configuration/components/custom-field-options-dialog-shell.generated';
import {
  createEmptyCustomFieldEditorRow,
  customFieldsEditorFormSchema,
  mapCustomFieldToEditorRow,
  type CustomFieldEditorRow,
  type CustomFieldsFormValues,
} from '../data-configuration/forms/custom-fields-editor';
import {
  CUSTOM_FIELD_ENTITY_TYPES,
  type CustomFieldEntityType,
  type CustomFieldOptionInput,
} from '../data-configuration/model/custom-field';
import { CustomFieldsEditorTable } from '../data-configuration/table/custom-fields-editor.generated';

const ENTITY_ICONS = {
  employee: Users,
} satisfies Record<CustomFieldEntityType, typeof Database>;

function isCustomFieldEntityType(
  value: string | null,
): value is CustomFieldEntityType {
  return (
    value !== null &&
    CUSTOM_FIELD_ENTITY_TYPES.includes(value as CustomFieldEntityType)
  );
}

function normalizeFieldRows(fields: CustomFieldEditorRow[]) {
  return fields.map((field) => ({
    ...field,
    key: field.key.trim(),
    label: field.label.trim(),
    options: field.options
      .map((option) => ({
        value: option.value.trim(),
        label: option.label.trim(),
      }))
      .filter((option) => option.value || option.label),
  }));
}

function validateFieldRows(fields: CustomFieldEditorRow[], intl: IntlShape) {
  const normalized = normalizeFieldRows(fields);
  const keys = new Set<string>();

  for (const field of normalized) {
    if (keys.has(field.key)) {
      throw new Error(
        intl.formatMessage(
          { id: 'customFields.errors.duplicateKey' },
          { key: field.key },
        ),
      );
    }
    keys.add(field.key);

    if (field.fieldType !== 'select') continue;
    if (field.options.length === 0) {
      throw new Error(
        intl.formatMessage(
          { id: 'customFields.errors.selectNeedsOption' },
          { field: field.label },
        ),
      );
    }
    if (field.options.some((option) => !option.value || !option.label)) {
      throw new Error(
        intl.formatMessage(
          { id: 'customFields.errors.optionIncomplete' },
          { field: field.label },
        ),
      );
    }
    if (
      new Set(field.options.map((option) => option.value)).size !==
      field.options.length
    ) {
      throw new Error(
        intl.formatMessage(
          { id: 'customFields.errors.duplicateOptionValue' },
          { field: field.label },
        ),
      );
    }
  }

  return normalized;
}

export function DataConfigurationPage() {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const canView = hasPermission('organization:custom-field:view');
  const canCreate = hasPermission('organization:custom-field:create');
  const canUpdate = hasPermission('organization:custom-field:update');
  const canDelete = hasPermission('organization:custom-field:delete');
  const queryClient = useQueryClient();
  const [selectedEntity, setSelectedEntity] = useState<CustomFieldEntityType>(
    () => {
      const entity = searchParams.get('entity');
      return isCustomFieldEntityType(entity) ? entity : 'employee';
    },
  );
  const [optionsIndex, setOptionsIndex] = useState<number | null>(null);
  const [optionDrafts, setOptionDrafts] = useState<CustomFieldOptionInput[]>(
    [],
  );
  const editorForm = useForm<CustomFieldsFormValues>({
    resolver: zodResolver(customFieldsEditorFormSchema),
    mode: 'onChange',
    defaultValues: { fields: [] },
  });

  const fieldsQuery = useQuery({
    queryKey: ['project', 'custom-fields', selectedEntity],
    queryFn: () => loadCustomFields(selectedEntity),
    enabled: canView,
  });

  useEffect(() => {
    if (!fieldsQuery.data) return;
    editorForm.reset({
      fields: fieldsQuery.data.map(mapCustomFieldToEditorRow),
    });
  }, [editorForm, fieldsQuery.data]);

  const invalidateFields = () =>
    queryClient.invalidateQueries({
      queryKey: ['project', 'custom-fields', selectedEntity],
    });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const values = editorForm.getValues();
      const parsed = customFieldsEditorFormSchema.safeParse(values);
      if (!parsed.success) {
        throw new Error(
          parsed.error.issues[0]?.message ??
            intl.formatMessage({ id: 'dataConfiguration.page.invalidData' }),
        );
      }
      const fields = validateFieldRows(parsed.data.fields, intl);
      return saveCustomFields(selectedEntity, fields);
    },
    onSuccess: async () => {
      editorForm.reset(editorForm.getValues());
      toast.success(intl.formatMessage({ id: 'dataConfiguration.page.saved' }));
      await invalidateFields();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const editorFields = editorForm.watch('fields') ?? [];
  const activeOptionsField =
    optionsIndex === null ? undefined : editorFields[optionsIndex];
  const canEditActiveOptions = activeOptionsField?.id ? canUpdate : canCreate;
  const optionsHaveError =
    optionDrafts.length === 0 ||
    optionDrafts.some(
      (option) => !option.value.trim() || !option.label.trim(),
    ) ||
    new Set(optionDrafts.map((option) => option.value.trim())).size !==
      optionDrafts.length;

  const openOptionsDialog = (index: number) => {
    const field = editorForm.getValues(`fields.${index}`);
    setOptionDrafts(
      field.options.length
        ? field.options.map((option) => ({ ...option }))
        : [{ value: '', label: '' }],
    );
    setOptionsIndex(index);
  };

  const closeOptionsDialog = () => {
    setOptionsIndex(null);
    setOptionDrafts([]);
  };

  const saveOptions = () => {
    if (optionsIndex === null || optionsHaveError) return;
    editorForm.setValue(
      `fields.${optionsIndex}.options`,
      optionDrafts.map((option) => ({
        value: option.value.trim(),
        label: option.label.trim(),
      })),
      { shouldDirty: true, shouldValidate: true },
    );
    closeOptionsDialog();
  };

  if (!canView) {
    return (
      <div className="flex h-full items-center justify-center p-4 lg:p-5">
        <Card className="flex max-w-lg flex-col items-center gap-3 p-10 text-center">
          <Database className="size-8 text-muted-foreground" />
          <CardTitle>
            {intl.formatMessage({ id: 'dataConfiguration.page.accessDenied' })}
          </CardTitle>
        </Card>
      </div>
    );
  }

  if (fieldsQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center p-4 lg:p-5">
        <Card className="flex max-w-lg flex-col items-center gap-3 p-10 text-center">
          <Database className="size-8 text-destructive" />
          <CardTitle>
            {intl.formatMessage({ id: 'dataConfiguration.page.loadError' })}
          </CardTitle>
          <Button variant="outline" onClick={() => fieldsQuery.refetch()}>
            {intl.formatMessage({ id: 'dataConfiguration.page.retry' })}
          </Button>
        </Card>
      </div>
    );
  }

  const hasUnsavedChanges = editorForm.formState.isDirty;
  const canEditTable = canCreate || canUpdate;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-admin-page-section overflow-y-auto p-4 xl:overflow-hidden xl:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'dataConfiguration.page.title' })}
        icon={ListTree}
        className="shrink-0"
      />
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-admin-page-section xl:flex-row xl:overflow-hidden">
        <Card className="max-h-[220px] w-full shrink-0 overflow-hidden xl:max-h-none xl:w-[260px]">
          <CardHeader className="min-h-0 flex-col items-start gap-1 p-4">
            <CardTitle className="text-[15px]">
              {intl.formatMessage({ id: 'dataConfiguration.page.subjectType' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto p-3 sm:grid-cols-3 xl:flex xl:flex-col">
            {PROJECT_ENTITY_ORDER.map((entityType) => {
              const Icon = ENTITY_ICONS[entityType];
              const isSelected = entityType === selectedEntity;

              return (
                <button
                  key={entityType}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/8 text-foreground'
                      : 'border-border bg-background hover:bg-field'
                  }`}
                  onClick={() => {
                    if (hasUnsavedChanges) {
                      toast.warning(
                        intl.formatMessage({
                          id: 'dataConfiguration.page.unsavedBeforeSubjectChange',
                        }),
                      );
                      return;
                    }
                    setSelectedEntity(entityType);
                    setSearchParams(
                      (currentParams) => {
                        const nextParams = new URLSearchParams(currentParams);
                        nextParams.set('entity', entityType);
                        return nextParams;
                      },
                      { replace: true },
                    );
                  }}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate text-[13px] font-semibold">
                    {intl.formatMessage({
                      id: `customFields.subjects.${entityType}`,
                    })}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="min-h-0 w-full min-w-0 flex-1 overflow-hidden">
          <CardContent className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-0">
            <CustomFieldsEditorTable
              form={editorForm}
              createRow={createEmptyCustomFieldEditorRow}
              toolbarTitle={
                <>
                  {intl.formatMessage({
                    id: 'customFields.fields.sectionTitle',
                  })}
                  :{' '}
                  <span className="font-semibold text-primary">
                    {intl.formatMessage({
                      id: `customFields.subjects.${selectedEntity}`,
                    })}
                  </span>
                </>
              }
              toolbarContent={
                canEditTable ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!hasUnsavedChanges}
                    loading={saveMutation.isPending}
                    loadingText={intl.formatMessage({
                      id: 'common.state.saving',
                    })}
                    onClick={() => saveMutation.mutate()}
                  >
                    <Save className="size-4" />
                    {intl.formatMessage({ id: 'settings.actions.saveChanges' })}
                  </Button>
                ) : null
              }
              onManageOptions={openOptionsDialog}
              readOnly={!canEditTable}
              canCreate={canCreate}
              canUpdate={canUpdate}
              canAdd={canCreate}
              canDelete={canDelete}
            />
          </CardContent>
        </Card>
      </div>

      <CustomFieldOptionsDialogShell
        open={optionsIndex !== null}
        onOpenChange={(open) => {
          if (!open) closeOptionsDialog();
        }}
        dialogTitle={
          <>
            {intl.formatMessage(
              { id: 'customFields.options.fieldTitle' },
              {
                field:
                  activeOptionsField?.label ||
                  intl.formatMessage({ id: 'customFields.fields.newField' }),
              },
            )}
          </>
        }
        onCancel={closeOptionsDialog}
        onSave={saveOptions}
        isSaving={false}
        canSave={!optionsHaveError && canEditActiveOptions}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-center gap-2 text-sm font-medium text-foreground">
            <span>
              {intl.formatMessage({ id: 'customFields.options.value' })}
            </span>
            <span>
              {intl.formatMessage({ id: 'customFields.options.label' })}
            </span>
            <span aria-hidden="true" />
          </div>
          {optionDrafts.map((option, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-center gap-2"
            >
              <Input
                value={option.value}
                disabled={!canEditActiveOptions}
                onChange={(event) =>
                  setOptionDrafts((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, value: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <Input
                value={option.label}
                disabled={!canEditActiveOptions}
                onChange={(event) =>
                  setOptionDrafts((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, label: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="destructive"
                appearance="ghost"
                mode="icon"
                size="sm"
                aria-label={intl.formatMessage(
                  { id: 'customFields.options.deleteAria' },
                  { row: index + 1 },
                )}
                disabled={optionDrafts.length <= 1 || !canEditActiveOptions}
                onClick={() =>
                  setOptionDrafts((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canEditActiveOptions}
            onClick={() =>
              setOptionDrafts((current) => [
                ...current,
                { value: '', label: '' },
              ])
            }
          >
            {intl.formatMessage({ id: 'customFields.options.add' })}
          </Button>
        </div>
      </CustomFieldOptionsDialogShell>
    </div>
  );
}
