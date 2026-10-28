import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/ui/loading';
import { SingleFileUploadField } from '@/components/ui/single-file-upload-field';
import {
  downloadSpreadsheetTemplateFile,
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
  const [downloadingKey, setDownloadingKey] =
    useState<SpreadsheetTemplateKey | null>(null);
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

  const handleDownload = async (key: SpreadsheetTemplateKey) => {
    setDownloadingKey(key);
    try {
      const { fileName, blob } = await downloadSpreadsheetTemplateFile(key);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <Card>
      <CardHeader className="px-5 pb-0 pt-5">
        <CardHeading>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4 text-primary" />
            {intl.formatMessage({ id: 'settings.spreadsheetTemplates.title' })}
          </CardTitle>
        </CardHeading>
      </CardHeader>
      <CardContent className="space-y-5 px-5 pb-5 pt-3">
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
                  <SingleFileUploadField
                    id={`spreadsheet-template-${key}`}
                    fileName={query.data?.fileName}
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    canEdit={canManage}
                    disabled={saveMutation.isPending || downloadingKey !== null}
                    isUploading={isUploading}
                    isDownloading={downloadingKey === key}
                    chooseLabel={intl.formatMessage({
                      id: 'settings.spreadsheetTemplates.chooseFile',
                    })}
                    replaceLabel={intl.formatMessage({
                      id: 'settings.spreadsheetTemplates.replaceFile',
                    })}
                    downloadLabel={intl.formatMessage({
                      id: 'settings.spreadsheetTemplates.downloadFile',
                    })}
                    uploadingLabel={intl.formatMessage({
                      id: 'settings.spreadsheetTemplates.uploading',
                    })}
                    downloadingLabel={intl.formatMessage({
                      id: 'settings.spreadsheetTemplates.downloading',
                    })}
                    onFileSelected={(file) => handleFile(key, file)}
                    onDownload={() => void handleDownload(key)}
                  />
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
