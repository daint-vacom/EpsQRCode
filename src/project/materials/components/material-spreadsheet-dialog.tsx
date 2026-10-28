import { useMemo } from 'react';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import { useMaterialModelsQuery } from '@/project/material-models/hooks/use-material-models';
import { useSpreadsheetTemplateQuery } from '@/project/spreadsheets/hooks/use-spreadsheet-templates';
import { LoaderCircle } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import type { MaterialListFilters } from '../model/material';
import { getMaterialSpreadsheetFields } from '../spreadsheet/material-spreadsheet';
import { MaterialSpreadsheetExportDialogShell } from './material-spreadsheet-export-dialog-shell.generated';
import {
  MaterialSpreadsheetExportPanel,
  useMaterialSpreadsheetExport,
} from './material-spreadsheet-export-panel';
import { MaterialSpreadsheetImportDialogShell } from './material-spreadsheet-import-dialog-shell.generated';
import { MaterialSpreadsheetImportPanel } from './material-spreadsheet-import-panel';

interface MaterialSpreadsheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MaterialSpreadsheetExportDialogProps extends MaterialSpreadsheetDialogProps {
  filters: Omit<MaterialListFilters, 'page' | 'pageSize'>;
}

function useMaterialSpreadsheetOptions(enabled: boolean) {
  const intl = useIntl();
  const modelsQuery = useMaterialModelsQuery(enabled);
  const custodiansQuery = useCustodiansQuery(false, enabled);
  const models = useMemo(() => modelsQuery.data ?? [], [modelsQuery.data]);
  const custodians = useMemo(
    () => custodiansQuery.data ?? [],
    [custodiansQuery.data],
  );
  const fields = useMemo(
    () =>
      getMaterialSpreadsheetFields(models, custodians, (id, values) =>
        intl.formatMessage({ id }, values),
      ),
    [custodians, intl, models],
  );

  return { fields, models, custodians, modelsQuery, custodiansQuery };
}

function CatalogState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const intl = useIntl();
  if (loading) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
        role="status"
      >
        <LoaderCircle className="size-4 animate-spin" />
        {intl.formatMessage({
          id: 'project.materials.spreadsheet.loadingCatalog',
        })}
      </div>
    );
  }
  if (!error) return null;
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm text-destructive">
        {intl.formatMessage({
          id: 'project.materials.spreadsheet.catalogError',
        })}
      </p>
      <Button type="button" variant="outline" onClick={onRetry}>
        {intl.formatMessage({ id: 'common.actions.retry' })}
      </Button>
    </div>
  );
}

export function MaterialSpreadsheetImportDialog({
  open,
  onOpenChange,
}: MaterialSpreadsheetDialogProps) {
  const { hasPermission } = useUser();
  const canLoadSharedTemplate = hasPermission('files:file_manager:view');
  const sharedTemplateQuery = useSpreadsheetTemplateQuery(
    'materialsImport',
    open && canLoadSharedTemplate,
  );
  const { fields, models, custodians, modelsQuery, custodiansQuery } =
    useMaterialSpreadsheetOptions(open);
  const catalogsLoading = modelsQuery.isPending || custodiansQuery.isPending;
  const catalogsError = modelsQuery.isError || custodiansQuery.isError;

  return (
    <MaterialSpreadsheetImportDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onClose={() => onOpenChange(false)}
      contentClassName="max-w-5xl"
    >
      <CatalogState
        loading={catalogsLoading}
        error={catalogsError}
        onRetry={() => {
          void modelsQuery.refetch();
          void custodiansQuery.refetch();
        }}
      />
      {!catalogsLoading && !catalogsError ? (
        <MaterialSpreadsheetImportPanel
          fields={fields}
          models={models}
          custodians={custodians}
          sharedTemplate={sharedTemplateQuery.data ?? null}
          sharedTemplateLoading={
            canLoadSharedTemplate && sharedTemplateQuery.isPending
          }
          sharedTemplateError={
            !canLoadSharedTemplate || sharedTemplateQuery.isError
          }
        />
      ) : null}
    </MaterialSpreadsheetImportDialogShell>
  );
}

export function MaterialSpreadsheetExportDialog({
  open,
  onOpenChange,
  filters,
}: MaterialSpreadsheetExportDialogProps) {
  const { hasPermission } = useUser();
  const canLoadSharedTemplate = hasPermission('files:file_manager:view');
  const sharedTemplateQuery = useSpreadsheetTemplateQuery(
    'materialsExport',
    open && canLoadSharedTemplate,
  );
  const { fields, modelsQuery, custodiansQuery } =
    useMaterialSpreadsheetOptions(open);
  const catalogsLoading = modelsQuery.isPending || custodiansQuery.isPending;
  const catalogsError = modelsQuery.isError || custodiansQuery.isError;
  const sharedTemplate = sharedTemplateQuery.data ?? null;
  const sharedTemplateLoading =
    canLoadSharedTemplate && sharedTemplateQuery.isPending;
  const sharedTemplateError =
    !canLoadSharedTemplate || sharedTemplateQuery.isError;
  const exportState = useMaterialSpreadsheetExport({
    open,
    filters,
    fields,
    sharedTemplate,
    sharedTemplateLoading,
    sharedTemplateError,
    catalogsLoading,
    catalogsError,
  });

  return (
    <MaterialSpreadsheetExportDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onExport={() => void exportState.handleExport()}
      isExporting={exportState.exporting}
      exportDisabled={exportState.exportDisabled}
    >
      {catalogsLoading ? (
        <CatalogState loading error={false} onRetry={() => undefined} />
      ) : catalogsError ? (
        <CatalogState
          loading={false}
          error
          onRetry={() => {
            void modelsQuery.refetch();
            void custodiansQuery.refetch();
          }}
        />
      ) : (
        <MaterialSpreadsheetExportPanel state={exportState} />
      )}
    </MaterialSpreadsheetExportDialogShell>
  );
}
