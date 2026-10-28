import { FileSpreadsheet, LoaderCircle } from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { SpreadsheetError } from '@/lib/spreadsheets/xlsx';
import { useUser } from '@/providers/user-provider';
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
import {
  SPREADSHEET_TEMPLATE_DEFINITIONS,
  type SpreadsheetTemplateKey,
} from '../api/spreadsheet-templates.api';
import {
  useSaveSpreadsheetTemplateMutation,
  useSpreadsheetTemplateQuery,
} from '../hooks/use-spreadsheet-templates';

const templateKeys = Object.keys(
  SPREADSHEET_TEMPLATE_DEFINITIONS,
) as SpreadsheetTemplateKey[];

export function SpreadsheetTemplatesSettings({
  canManage,
}: {
  canManage: boolean;
}) {
  const intl = useIntl();
  const { userId } = useUser();
  const importTemplate = useSpreadsheetTemplateQuery('materialsImport');
  const exportTemplate = useSpreadsheetTemplateQuery('materialsExport');
  const saveMutation = useSaveSpreadsheetTemplateMutation();
  const queries = {
    materialsImport: importTemplate,
    materialsExport: exportTemplate,
  };
  const failedQuery = templateKeys
    .map((key) => queries[key])
    .find((query) => query.isError);
  const isLoading = templateKeys.some((key) => queries[key].isPending);

  const handleFile = (key: SpreadsheetTemplateKey, file?: File) => {
    if (!file || !userId) return;
    saveMutation.mutate(
      { key, file, userId },
      {
        onSuccess: () =>
          toast.success(
            intl.formatMessage({
              id: 'settings.spreadsheetTemplates.saved',
            }),
          ),
        onError: (error) =>
          toast.error(
            error instanceof SpreadsheetError
              ? intl.formatMessage({ id: error.message })
              : getApiErrorMessage(error),
          ),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="p-5">
        <CardHeading>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4 text-primary" />
            {intl.formatMessage({ id: 'settings.spreadsheetTemplates.title' })}
          </CardTitle>
        </CardHeading>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        {isLoading ? (
          <PageLoading
            label={intl.formatMessage({ id: 'common.state.loading' })}
          />
        ) : failedQuery ? (
          <ErrorState
            title={intl.formatMessage({
              id: 'settings.spreadsheetTemplates.loadErrorTitle',
            })}
            description={getApiErrorMessage(failedQuery.error)}
            onRetry={() => {
              void importTemplate.refetch();
              void exportTemplate.refetch();
            }}
          />
        ) : (
          <div className="space-y-5">
            {templateKeys.map((key) => {
              const definition = SPREADSHEET_TEMPLATE_DEFINITIONS[key];
              const query = queries[key];
              const isUploading =
                saveMutation.isPending && saveMutation.variables?.key === key;
              return (
                <div
                  className="grid grid-cols-[8.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1"
                  key={key}
                >
                  <div className="pt-2">
                    {canManage ? (
                      <Label
                        variant="secondary"
                        htmlFor={`spreadsheet-template-${key}`}
                      >
                        {intl.formatMessage({ id: definition.titleMessageId })}
                      </Label>
                    ) : (
                      <p className="text-sm font-normal text-foreground">
                        {intl.formatMessage({ id: definition.titleMessageId })}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    {query.data ? (
                      <p
                        className="truncate pt-2 text-sm text-muted-foreground"
                        title={query.data.fileName}
                      >
                        {query.data.fileName}
                      </p>
                    ) : !canManage ? (
                      <p className="pt-2 text-sm text-muted-foreground">—</p>
                    ) : null}
                    {canManage ? (
                      <Input
                        id={`spreadsheet-template-${key}`}
                        type="file"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        disabled={saveMutation.isPending}
                        aria-label={intl.formatMessage({
                          id: 'settings.spreadsheetTemplates.chooseFile',
                        })}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = '';
                          handleFile(key, file);
                        }}
                      />
                    ) : null}
                    {isUploading ? (
                      <p
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                        role="status"
                      >
                        <LoaderCircle className="size-3.5 animate-spin" />
                        {intl.formatMessage({ id: 'common.state.loading' })}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {canManage ? (
          <p className="text-xs text-muted-foreground">
            {intl.formatMessage({
              id: 'settings.spreadsheetTemplates.fileHelp',
            })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
