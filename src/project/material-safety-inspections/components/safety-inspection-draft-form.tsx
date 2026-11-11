import { useEffect, useMemo, useState } from 'react';
import { HandoverAttachmentsField } from '@/project/handover/components/handover-attachments-field';
import type { HandoverAttachment } from '@/project/handover/model/handover';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownToLine } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { Path } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type {
  SafetyInspection,
  SafetyInspectionAttachment,
  SafetyInspectionFormValues,
  SafetyInspectionResult,
} from '../model/safety-inspection';
import {
  safetyInspectionDraftFormSchema,
  safetyInspectionFormSchema,
} from '../model/safety-inspection';
import { SafetyInspectionChecklistResultTable } from './safety-inspection-checklist-display';

export const SAFETY_INSPECTION_DRAFT_FORM_ID = 'safety-inspection-draft-form';
const NO_HANDOVER_ATTACHMENTS: HandoverAttachment[] = [];

function parseInspectionDateTime(value: string): Date | undefined {
  if (!value) return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatInspectionTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

function getInspectionTime(value: string): string {
  const date = parseInspectionDateTime(value);
  return date ? formatInspectionTime(date) : '';
}

function combineInspectionDateAndTime(date: Date, time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date);
  if (Number.isInteger(hours) && Number.isInteger(minutes)) {
    result.setHours(hours, minutes, 0, 0);
  }
  return result.toISOString();
}

function toFormValues(
  inspection: SafetyInspection,
): SafetyInspectionFormValues {
  return {
    inspectedAt: inspection.inspectedAt,
    inspectorName: inspection.inspectorName,
    checklistResult: inspection.checklistResult,
    overallNote: inspection.overallNote,
    overallResult: inspection.overallResult ?? undefined,
  };
}

export function SafetyInspectionDraftForm({
  inspection,
  onSave,
  isSaving,
}: {
  inspection: SafetyInspection;
  onSave: (
    values: SafetyInspectionFormValues,
    attachments: SafetyInspectionAttachment[],
    files: File[],
    complete: boolean,
  ) => Promise<boolean>;
  isSaving: boolean;
}) {
  const intl = useIntl();
  const form = useForm<SafetyInspectionFormValues>({
    resolver: zodResolver(safetyInspectionDraftFormSchema),
    defaultValues: toFormValues(inspection),
  });
  const [files, setFiles] = useState<File[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    form.reset(toFormValues(inspection));
    setFiles([]);
    setRemovedAttachmentIds(new Set());
  }, [form, inspection]);

  const retainedAttachments = useMemo(
    () =>
      inspection.attachments.filter(
        (attachment) => !removedAttachmentIds.has(attachment.id),
      ),
    [inspection.attachments, removedAttachmentIds],
  );
  const submit = (complete: boolean) =>
    form.handleSubmit(async (values) => {
      if (complete) {
        const validation = safetyInspectionFormSchema.safeParse(values);
        if (!validation.success) {
          validation.error.issues.forEach((issue) => {
            const fieldPath = issue.path
              .map(String)
              .join('.') as Path<SafetyInspectionFormValues>;
            form.setError(fieldPath, {
              type: 'manual',
              message: issue.message,
            });
          });
          return;
        }
      }
      const saved = await onSave(values, retainedAttachments, files, complete);
      if (!saved) {
        return;
      }
      setFiles([]);
      setRemovedAttachmentIds(new Set());
    })();

  return (
    <Form {...form}>
      <form
        id={SAFETY_INSPECTION_DRAFT_FORM_ID}
        onSubmit={(event) => {
          event.preventDefault();
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          void submit(submitter?.getAttribute('value') === 'complete');
        }}
        className="mx-auto flex w-full max-w-5xl flex-col gap-4"
      >
        <Card>
          <CardContent className="grid gap-5">
            <FormField
              control={form.control}
              name="inspectedAt"
              render={({ field, fieldState }) => (
                <FormItem layout="horizontal" labelWidth="md">
                  <FormLabel>
                    {intl.formatMessage({
                      id: 'project.materials.safetyInspection.fields.inspectedAt',
                    })}
                  </FormLabel>
                  <FormControl>
                    <DatePickerInput
                      value={parseInspectionDateTime(field.value)}
                      onChange={(value) => {
                        if (!(value instanceof Date)) {
                          field.onChange('');
                          return;
                        }
                        const currentDate = parseInspectionDateTime(
                          field.value,
                        );
                        field.onChange(
                          combineInspectionDateAndTime(
                            value,
                            formatInspectionTime(currentDate ?? new Date()),
                          ),
                        );
                      }}
                      onBlur={() => field.onBlur()}
                      showTime
                      dateInputWidth="md"
                      timeValue={getInspectionTime(field.value)}
                      onTimeChange={(time) => {
                        if (!time) {
                          field.onChange('');
                          return;
                        }
                        const currentDate = parseInspectionDateTime(
                          field.value,
                        );
                        if (currentDate) {
                          field.onChange(
                            combineInspectionDateAndTime(currentDate, time),
                          );
                        }
                      }}
                      onTimeBlur={() => field.onBlur()}
                      variant="md"
                      disabled={isSaving}
                      aria-invalid={fieldState.invalid}
                    />
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
          <CardContent>
            <SafetyInspectionChecklistResultTable
              groups={inspection.checklistResult}
              form={form}
            />
          </CardContent>
        </Card>

        <Card>
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
                <FormItem layout="horizontal" labelWidth="md" alignment="start">
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

            {retainedAttachments.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {intl.formatMessage({
                    id: 'project.materials.safetyInspection.attachments.saved',
                  })}
                </p>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {retainedAttachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        {attachment.fileName}
                      </span>
                      {attachment.url ? (
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ArrowDownToLine />
                            {intl.formatMessage({
                              id: 'project.materials.safetyInspection.attachments.download',
                            })}
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isSaving}
                        onClick={() =>
                          setRemovedAttachmentIds((current) =>
                            new Set(current).add(attachment.id),
                          )
                        }
                      >
                        {intl.formatMessage({ id: 'common.actions.delete' })}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <HandoverAttachmentsField
              attachments={NO_HANDOVER_ATTACHMENTS}
              files={files}
              onFilesChange={setFiles}
              onRemove={() => undefined}
              disabled={isSaving}
              isUploading={isSaving}
            />
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
