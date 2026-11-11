import { Controller } from 'react-hook-form';
import type { Path, UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SafetyInspectionFormValues } from '../model/safety-inspection';
import type { SafetyInspectionChecklistGroup } from '../model/safety-inspection-checklist';

type SafetyInspectionChecklistTableGroup = {
  id: string;
  name: string;
  criteria: Array<{
    id: string;
    content: string;
    passed?: boolean | null;
    note?: string;
  }>;
};

export function SafetyInspectionChecklistDisplay({
  groups,
  emptyMessageId = 'project.materials.safetyInspection.checklist.empty',
  showCount = true,
}: {
  groups: SafetyInspectionChecklistGroup[];
  emptyMessageId?: string;
  showCount?: boolean;
}) {
  return (
    <SafetyInspectionChecklistTable
      groups={groups}
      emptyMessageId={emptyMessageId}
      showCount={showCount}
    />
  );
}

export function SafetyInspectionChecklistResultTable({
  groups,
  form,
  disabled = false,
}: {
  groups: SafetyInspectionChecklistTableGroup[];
  form?: UseFormReturn<SafetyInspectionFormValues>;
  disabled?: boolean;
}) {
  return (
    <SafetyInspectionChecklistTable
      groups={groups}
      form={form}
      disabled={disabled}
      showResultColumns
    />
  );
}

function SafetyInspectionChecklistTable({
  groups,
  form,
  disabled = false,
  emptyMessageId = 'project.materials.safetyInspection.checklist.empty',
  showCount = true,
  showResultColumns = false,
}: {
  groups: SafetyInspectionChecklistTableGroup[];
  form?: UseFormReturn<SafetyInspectionFormValues>;
  disabled?: boolean;
  emptyMessageId?: string;
  showCount?: boolean;
  showResultColumns?: boolean;
}) {
  const intl = useIntl();
  const criteriaCount = groups.reduce(
    (count, group) => count + group.criteria.length,
    0,
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {showCount ? (
        <span className="shrink-0 text-sm text-foreground">
          {intl.formatMessage(
            { id: 'project.materials.safetyInspection.checklist.count' },
            { groups: groups.length, criteria: criteriaCount },
          )}
        </span>
      ) : null}
      <ScrollArea
        className={
          groups.length > 0
            ? 'rounded-md border border-border bg-background'
            : undefined
        }
      >
        {groups.length === 0 ? (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border px-4 text-sm text-muted-foreground">
            {intl.formatMessage({ id: emptyMessageId })}
          </div>
        ) : (
          <div
            className={
              showResultColumns ? 'min-w-[760px]' : 'min-w-[760px] pb-1 pe-2'
            }
          >
            <table className="w-full table-fixed border-collapse bg-background text-foreground text-sm">
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead className="sticky top-0 z-20 w-20 border-e border-border bg-background px-2 text-left">
                    {intl.formatMessage({
                      id: 'project.materials.safetyInspection.checklist.rowNumber',
                    })}
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 border-e border-border bg-background px-3">
                    {intl.formatMessage({
                      id: 'project.materials.safetyInspection.checklist.criterion',
                    })}
                  </TableHead>
                  {showResultColumns ? (
                    <>
                      <TableHead className="sticky top-0 z-20 w-16 border-e border-border bg-background px-1 text-center">
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.results.passed',
                        })}
                      </TableHead>
                      <TableHead className="sticky top-0 z-20 w-56 bg-background px-3">
                        {intl.formatMessage({
                          id: 'project.materials.safetyInspection.checklist.note',
                        })}
                      </TableHead>
                    </>
                  ) : (
                    <TableHead className="sticky top-0 z-20 w-20 bg-background px-1 text-center" />
                  )}
                </TableRow>
              </TableHeader>
              {groups.map((group, groupIndex) => {
                const groupNumber = groupIndex + 1;

                return (
                  <TableBody
                    key={group.id}
                    className="[&_tr:last-child]:!border-b"
                  >
                    <TableRow hoverable={false} className="bg-background">
                      <TableCell className="w-20 border-e border-border px-2 py-2 text-left">
                        <span className="text-xs font-semibold tabular-nums text-foreground">
                          {groupNumber}
                        </span>
                      </TableCell>
                      <TableCell className="border-e border-border px-2 py-1">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                            {group.name}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="secondary"
                                appearance="light"
                                size="sm"
                                tabIndex={0}
                                className="cursor-help"
                                aria-label={intl.formatMessage(
                                  {
                                    id: 'project.materials.safetyInspection.checklist.criteriaCount',
                                  },
                                  { count: group.criteria.length },
                                )}
                              >
                                {group.criteria.length}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {intl.formatMessage(
                                {
                                  id: 'project.materials.safetyInspection.checklist.criteriaCount',
                                },
                                { count: group.criteria.length },
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      {showResultColumns ? (
                        <>
                          <TableCell className="w-16 border-e border-border px-1 py-1 text-center" />
                          <TableCell className="w-56 px-2 py-1" />
                        </>
                      ) : (
                        <TableCell className="w-20 px-1 py-1 text-center" />
                      )}
                    </TableRow>
                    {group.criteria.map((criterion, criterionIndex) => (
                      <TableRow
                        key={criterion.id}
                        hoverable={false}
                        className="bg-background"
                      >
                        <TableCell className="w-20 border-e border-border px-2 py-2 text-left">
                          <span className="text-sm tabular-nums text-foreground">
                            {`${groupNumber}.${criterionIndex + 1}`}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-0 border-e border-border px-2 py-2 whitespace-normal break-words text-foreground">
                          {criterion.content}
                        </TableCell>
                        {showResultColumns ? (
                          <>
                            <TableCell className="w-16 border-e border-border px-1 py-1 text-center">
                              {form ? (
                                <Controller
                                  control={form.control}
                                  name={
                                    `checklistResult.${groupIndex}.criteria.${criterionIndex}.passed` as Path<SafetyInspectionFormValues>
                                  }
                                  render={({ field, fieldState }) => (
                                    <div className="flex flex-col items-center gap-1">
                                      <Checkbox
                                        checked={field.value === true}
                                        onCheckedChange={(checked) =>
                                          field.onChange(checked === true)
                                        }
                                        disabled={disabled}
                                        aria-label={`${intl.formatMessage({ id: 'project.materials.safetyInspection.results.passed' })}: ${criterion.content}`}
                                        aria-invalid={fieldState.invalid}
                                        size="sm"
                                      />
                                      {fieldState.error ? (
                                        <span className="max-w-24 text-center text-xs text-destructive">
                                          {fieldState.error.message}
                                        </span>
                                      ) : null}
                                    </div>
                                  )}
                                />
                              ) : (
                                <Checkbox
                                  checked={criterion.passed === true}
                                  disabled
                                  aria-label={`${intl.formatMessage({ id: 'project.materials.safetyInspection.fields.criteriaResult' })}: ${criterion.content}`}
                                  size="sm"
                                />
                              )}
                            </TableCell>
                            <TableCell className="w-56 px-2 py-1">
                              {form ? (
                                <Controller
                                  control={form.control}
                                  name={
                                    `checklistResult.${groupIndex}.criteria.${criterionIndex}.note` as Path<SafetyInspectionFormValues>
                                  }
                                  render={({ field, fieldState }) => (
                                    <div className="space-y-1">
                                      <Textarea
                                        {...field}
                                        rows={2}
                                        variant="md"
                                        disabled={disabled}
                                        aria-label={`${intl.formatMessage({ id: 'project.materials.safetyInspection.fields.criteriaNote' })}: ${criterion.content}`}
                                        aria-invalid={fieldState.invalid}
                                      />
                                      {fieldState.error ? (
                                        <span className="text-xs text-destructive">
                                          {fieldState.error.message}
                                        </span>
                                      ) : null}
                                    </div>
                                  )}
                                />
                              ) : criterion.note ? (
                                <span className="text-sm text-foreground">
                                  {criterion.note}
                                </span>
                              ) : null}
                            </TableCell>
                          </>
                        ) : (
                          <TableCell className="w-20 px-1 py-1" />
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                );
              })}
            </table>
          </div>
        )}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
