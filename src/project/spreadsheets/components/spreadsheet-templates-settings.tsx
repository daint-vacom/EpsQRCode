import { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { SpreadsheetError } from '@/lib/spreadsheets/xlsx';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { FileIcon } from '@/components/ui/files/file-icon';
import { PageLoading } from '@/components/ui/loading';
import {
  downloadSpreadsheetTemplateFile,
  SPREADSHEET_TEMPLATE_DEFINITIONS,
  type SpreadsheetTemplateKey,
  type SpreadsheetTemplateSummary,
} from '../api/spreadsheet-templates.api';
import {
  useDeleteSpreadsheetTemplateMutation,
  useSaveSpreadsheetTemplateMutation,
  useSpreadsheetTemplatesQuery,
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
  const templateQueries = {
    materialsImport: useSpreadsheetTemplatesQuery('materialsImport'),
    materialsExport: useSpreadsheetTemplatesQuery('materialsExport'),
  };
  const saveMutation = useSaveSpreadsheetTemplateMutation();
  const deleteMutation = useDeleteSpreadsheetTemplateMutation();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [templateToDelete, setTemplateToDelete] =
    useState<SpreadsheetTemplateSummary | null>(null);
  const failedQuery = templateKeys
    .map((key) => templateQueries[key])
    .find((query) => query.isError);
  const isLoading = templateKeys.some((key) => templateQueries[key].isPending);

  const handleFile = (key: SpreadsheetTemplateKey, file?: File) => {
    if (!file || !userId) return;
    saveMutation.mutate(
      { key, file, userId },
      {
        onSuccess: () =>
          toast.success(
            intl.formatMessage({ id: 'settings.spreadsheetTemplates.saved' }),
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

  const handleDownload = async (template: SpreadsheetTemplateSummary) => {
    setDownloadingId(template.id);
    try {
      const { fileName, blob } = await downloadSpreadsheetTemplateFile(
        template.key,
        template.id,
      );
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
      setDownloadingId(null);
    }
  };

  const handleDelete = () => {
    if (!templateToDelete || templateToDelete.isBundled) return;
    deleteMutation.mutate(
      {
        key: templateToDelete.key,
        templateId: templateToDelete.id,
      },
      {
        onSuccess: () => {
          toast.success(
            intl.formatMessage({ id: 'settings.spreadsheetTemplates.deleted' }),
          );
          setTemplateToDelete(null);
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="px-5 pb-0 pt-5">
          <CardHeading>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="size-4 text-primary" />
              {intl.formatMessage({
                id: 'settings.spreadsheetTemplates.title',
              })}
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
                templateKeys.forEach((key) => {
                  void templateQueries[key].refetch();
                });
              }}
            />
          ) : (
            <div className="space-y-5">
              {templateKeys.map((key) => {
                const definition = SPREADSHEET_TEMPLATE_DEFINITIONS[key];
                const query = templateQueries[key];
                const templates = query.data ?? [];
                const isUploading =
                  saveMutation.isPending && saveMutation.variables?.key === key;
                return (
                  <section className="space-y-3" key={key}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-foreground">
                        {intl.formatMessage({ id: definition.titleMessageId })}
                      </h3>
                      {canManage ? (
                        <>
                          <input
                            id={`spreadsheet-template-${key}`}
                            className="sr-only"
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
                          <Button
                            type="button"
                            variant="outline"
                            size="md"
                            disabled={saveMutation.isPending || !userId}
                            onClick={() => {
                              const input = document.getElementById(
                                `spreadsheet-template-${key}`,
                              );
                              if (input instanceof HTMLInputElement)
                                input.click();
                            }}
                          >
                            {isUploading ? (
                              <LoaderCircle className="animate-spin" />
                            ) : (
                              <Plus />
                            )}
                            {intl.formatMessage({
                              id: isUploading
                                ? 'settings.spreadsheetTemplates.uploading'
                                : 'settings.spreadsheetTemplates.addFile',
                            })}
                          </Button>
                        </>
                      ) : null}
                    </div>

                    <ul className="divide-y rounded-md border">
                      {templates.map((template) => {
                        const isDownloading = downloadingId === template.id;
                        return (
                          <li
                            className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                            key={template.id}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <FileIcon
                                fileType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                fileName={template.fileName}
                                alt=""
                                aria-hidden="true"
                                className="size-5 shrink-0"
                              />
                              <div className="min-w-0">
                                <p
                                  className="truncate text-sm text-foreground"
                                  title={template.fileName}
                                >
                                  {template.fileName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {intl.formatMessage({
                                    id: template.isBundled
                                      ? 'settings.spreadsheetTemplates.defaultTemplate'
                                      : 'settings.spreadsheetTemplates.sharedTemplate',
                                  })}
                                  {template.updatedAt
                                    ? ` · ${new Intl.DateTimeFormat(
                                        intl.locale,
                                        { dateStyle: 'medium' },
                                      ).format(new Date(template.updatedAt))}`
                                    : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={
                                  downloadingId !== null ||
                                  saveMutation.isPending ||
                                  deleteMutation.isPending
                                }
                                onClick={() => void handleDownload(template)}
                              >
                                {isDownloading ? (
                                  <LoaderCircle className="animate-spin" />
                                ) : (
                                  <Download />
                                )}
                                {intl.formatMessage({
                                  id: isDownloading
                                    ? 'settings.spreadsheetTemplates.downloading'
                                    : 'settings.spreadsheetTemplates.downloadFile',
                                })}
                              </Button>
                              {canManage && !template.isBundled ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={
                                    saveMutation.isPending ||
                                    deleteMutation.isPending ||
                                    downloadingId !== null
                                  }
                                  onClick={() => setTemplateToDelete(template)}
                                >
                                  <Trash2 />
                                  {intl.formatMessage({
                                    id: 'settings.spreadsheetTemplates.deleteFile',
                                  })}
                                </Button>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
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

      <ConfirmDialog
        open={templateToDelete !== null}
        onOpenChange={(open) => !open && setTemplateToDelete(null)}
        title={intl.formatMessage({
          id: 'settings.spreadsheetTemplates.deleteConfirmTitle',
        })}
        description={intl.formatMessage(
          { id: 'settings.spreadsheetTemplates.deleteConfirmDescription' },
          { name: templateToDelete?.fileName ?? '' },
        )}
        confirmLabel={intl.formatMessage({
          id: 'settings.spreadsheetTemplates.deleteFile',
        })}
        cancelLabel={intl.formatMessage({
          id: 'settings.spreadsheetTemplates.cancel',
        })}
        confirmVariant="destructive"
        isConfirming={deleteMutation.isPending}
        closeOnConfirm={false}
        onConfirm={handleDelete}
      />
    </>
  );
}
