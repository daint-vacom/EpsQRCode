import { useEffect, useMemo, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { HandoverAttachmentsField } from '@/project/handover/components/handover-attachments-field';
import { useMaterialQuery } from '@/project/materials/hooks/use-materials';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardPenLine } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import type { Path, UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorState } from '@/components/ui/error-state';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PageLoading } from '@/components/ui/loading';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useDetailEntryLayoutHeader } from '@/components/layouts/detail-entry-layout';
import { useCreateMaterialSafetyInspectionMutation } from '../hooks/use-safety-inspections';
import {
  makeSafetyInspectionFormValues,
  safetyInspectionFormSchema,
} from '../model/safety-inspection';
import type {
  SafetyInspectionFormValues,
  SafetyInspectionResult,
} from '../model/safety-inspection';
import { mergeSafetyInspectionChecklists } from '../model/safety-inspection-checklist';

const FORM_ID = 'material-safety-inspection-form';

function toLocalDateTimeInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function MaterialSafetyInspectionCreatePage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { user, hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const materialQuery = useMaterialQuery(id, !isPermissionsPending && canView);
  const material = materialQuery.data;
  const checklist = useMemo(
    () =>
      mergeSafetyInspectionChecklists(
        material?.modelSnapshot.safetyInspectionChecklist,
        material?.safetyInspectionChecklist,
      ),
    [material],
  );
  const form = useForm<SafetyInspectionFormValues>({
    resolver: zodResolver(safetyInspectionFormSchema),
    defaultValues: makeSafetyInspectionFormValues(
      [],
      user?.name ?? '',
      toLocalDateTimeInputValue(new Date()),
    ),
  });
  const [files, setFiles] = useState<File[]>([]);
  const createMutation = useCreateMaterialSafetyInspectionMutation();
  const materialPath = buildPath(ROUTES.PROJECT.MATERIAL_DETAIL, { id });
  const title = intl.formatMessage({
    id: 'project.materials.safetyInspection.page.createTitle',
  });

  useEffect(() => {
    if (!material) return;
    form.reset(
      makeSafetyInspectionFormValues(
        checklist,
        user?.name ?? '',
        toLocalDateTimeInputValue(new Date()),
      ),
    );
    setFiles([]);
  }, [checklist, form, material, user?.name]);

  const header = useMemo(
    () => ({
      title,
      icon: ClipboardPenLine,
      showBackButton: true,
      backLabel: intl.formatMessage({
        id: 'project.materials.safetyInspection.actions.back',
      }),
      onBack: () => navigate(materialPath),
      actions:
        canManage && material ? (
          <Button
            type="submit"
            form={FORM_ID}
            size="md"
            variant="primary"
            loading={createMutation.isPending}
            loadingText={intl.formatMessage({ id: 'common.state.saving' })}
          >
            {intl.formatMessage({
              id: 'project.materials.safetyInspection.actions.save',
            })}
          </Button>
        ) : null,
    }),
    [
      canManage,
      createMutation.isPending,
      intl,
      material,
      materialPath,
      navigate,
      title,
    ],
  );
  useDetailEntryLayoutHeader(header);

  const handleSubmit = (values: SafetyInspectionFormValues) => {
    if (!canManage || !material || !values.overallResult) return;
    createMutation.mutate(
      { materialId: material.id, values, files },
      {
        onSuccess: (inspectionId) => {
          toast.success(
            intl.formatMessage({
              id: 'project.materials.safetyInspection.toasts.created',
            }),
          );
          navigate(
            buildPath(ROUTES.PROJECT.MATERIAL_SAFETY_INSPECTION_DETAIL, {
              id: material.id,
              inspectionId,
            }),
          );
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  const isLoading =
    isPermissionsPending || (canView && materialQuery.isPending);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:p-5">
      {!isPermissionsPending && (!canView || !canManage) ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.errors.authorizationTitle',
          })}
          description={intl.formatMessage({
            id: 'project.materials.errors.authorization',
          })}
        />
      ) : isLoading ? (
        <PageLoading
          label={intl.formatMessage({ id: 'common.state.loading' })}
        />
      ) : materialQuery.isError ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.errors.loadDetailTitle',
          })}
          description={getApiErrorMessage(materialQuery.error)}
          onRetry={() => void materialQuery.refetch()}
        />
      ) : !material ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.errors.notFoundTitle',
          })}
          description={intl.formatMessage({
            id: 'project.materials.errors.notFound',
          })}
        />
      ) : !material.modelSnapshot.requiresInspection ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.safetyInspection.page.createTitle',
          })}
          description={intl.formatMessage({
            id: 'project.materials.safetyInspection.errors.notRequired',
          })}
        />
      ) : checklist.length === 0 ? (
        <ErrorState
          title={intl.formatMessage({
            id: 'project.materials.safetyInspection.page.createTitle',
          })}
          description={intl.formatMessage({
            id: 'project.materials.safetyInspection.errors.noChecklist',
          })}
          onRetry={() =>
            navigate(buildPath(ROUTES.PROJECT.MATERIAL_EDIT, { id }))
          }
        />
      ) : (
        <Form {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit(handleSubmit)}
            className="mx-auto flex w-full max-w-5xl flex-col gap-4"
          >
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">
                {intl.formatMessage({
                  id: 'project.materials.safetyInspection.page.createDescription',
                })}
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>
                  {intl.formatMessage({
                    id: 'project.materials.safetyInspection.sections.information',
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5">
                <FormField
                  control={form.control}
                  name="inspectedAt"
                  render={({ field }) => (
                    <FormItem layout="horizontal" labelWidth="md">
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.fields.inspectedAt',
                        })}
                      </FormLabel>
                      <FormControl>
                        <Input type="datetime-local" variant="md" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="inspectorName"
                  render={({ field }) => (
                    <FormItem layout="horizontal" labelWidth="md">
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.fields.inspector',
                        })}
                      </FormLabel>
                      <FormControl>
                        <Input variant="md" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {intl.formatMessage({
                    id: 'project.materials.safetyInspection.sections.checklist',
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {checklist.map((group, groupIndex) => (
                  <section key={group.id} className="space-y-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      {group.name}
                    </h2>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {group.criteria.map((criterion, criterionIndex) => (
                        <SafetyInspectionCriterionField
                          key={criterion.id}
                          form={form}
                          groupIndex={groupIndex}
                          criterionIndex={criterionIndex}
                          content={criterion.content}
                          intl={intl}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {intl.formatMessage({
                    id: 'project.materials.safetyInspection.fields.result',
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField
                  control={form.control}
                  name="overallResult"
                  render={({ field }) => (
                    <FormItem layout="horizontal" labelWidth="md">
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.fields.result',
                        })}
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value ?? ''}
                          onValueChange={(value) =>
                            field.onChange(value as SafetyInspectionResult)
                          }
                          className="flex flex-wrap gap-4"
                        >
                          {(['passed', 'failed'] as const).map((result) => (
                            <label
                              key={result}
                              className="flex items-center gap-2 text-sm text-foreground"
                            >
                              <RadioGroupItem value={result} />
                              {intl.formatMessage({
                                id: `project.materials.safetyInspection.results.${result}`,
                              })}
                            </label>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="overallNote"
                  render={({ field }) => (
                    <FormItem
                      layout="horizontal"
                      labelWidth="md"
                      alignment="start"
                    >
                      <FormLabel>
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.fields.note',
                        })}
                      </FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <HandoverAttachmentsField
                  attachments={[]}
                  files={files}
                  onFilesChange={setFiles}
                  onRemove={() => undefined}
                  disabled={createMutation.isPending}
                  isUploading={createMutation.isPending}
                />
              </CardContent>
            </Card>
            <div className="flex justify-end pb-2">
              <Button
                type="submit"
                size="md"
                loading={createMutation.isPending}
                loadingText={intl.formatMessage({ id: 'common.state.saving' })}
              >
                {intl.formatMessage({
                  id: 'project.materials.safetyInspection.actions.save',
                })}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}

function SafetyInspectionCriterionField({
  form,
  groupIndex,
  criterionIndex,
  content,
  intl,
}: {
  form: UseFormReturn<SafetyInspectionFormValues>;
  groupIndex: number;
  criterionIndex: number;
  content: string;
  intl: ReturnType<typeof useIntl>;
}) {
  const passedName =
    `checklistResult.${groupIndex}.criteria.${criterionIndex}.passed` as Path<SafetyInspectionFormValues>;
  const noteName =
    `checklistResult.${groupIndex}.criteria.${criterionIndex}.note` as Path<SafetyInspectionFormValues>;

  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.7fr)] md:items-center">
      <div className="flex items-start gap-3">
        <Controller
          control={form.control}
          name={passedName}
          render={({ field }) => (
            <Checkbox
              checked={field.value as boolean}
              aria-label={`${intl.formatMessage({ id: 'project.materials.safetyInspection.fields.criteriaResult' })}: ${content}`}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">{content}</p>
          <Controller
            control={form.control}
            name={passedName}
            render={({ field }) => (
              <Badge
                variant={field.value ? 'success' : 'destructive'}
                size="sm"
                className="mt-1"
              >
                {intl.formatMessage({
                  id: field.value
                    ? 'project.materials.safetyInspection.results.passed'
                    : 'project.materials.safetyInspection.results.failed',
                })}
              </Badge>
            )}
          />
        </div>
      </div>
      <Controller
        control={form.control}
        name={noteName}
        render={({ field }) => (
          <Textarea
            rows={2}
            {...field}
            aria-label={`${intl.formatMessage({ id: 'project.materials.safetyInspection.fields.criteriaNote' })}: ${content}`}
          />
        )}
      />
    </div>
  );
}
