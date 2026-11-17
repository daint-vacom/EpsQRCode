import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useCustodiansQuery } from '@/project/custodians/hooks/use-custodians';
import { useMaterialGroupsQuery } from '@/project/material-groups/hooks/use-material-groups';
import type { MaterialGroup } from '@/project/material-groups/model/material-group';
import { useMaterialModelsQuery } from '@/project/material-models/hooks/use-material-models';
import { useMaterialSpecificationsQuery } from '@/project/material-specifications/hooks/use-material-specifications';
import { LoaderCircle } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import { useMaterialCapitalSourcesQuery } from '../hooks/use-material-capital-sources';
import type { MaterialListFilters } from '../model/material';
import {
  getMaterialSpreadsheetExportFields,
  getMaterialSpreadsheetFields,
} from '../spreadsheet/material-spreadsheet';
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

function useMaterialSpreadsheetOptions(
  enabled: boolean,
  groups: MaterialGroup[] = [],
) {
  const intl = useIntl();
  const modelsQuery = useMaterialModelsQuery(enabled);
  const custodiansQuery = useCustodiansQuery(false, enabled);
  const capitalSourcesQuery = useMaterialCapitalSourcesQuery(enabled);
  const models = useMemo(() => modelsQuery.data ?? [], [modelsQuery.data]);
  const custodians = useMemo(
    () => custodiansQuery.data ?? [],
    [custodiansQuery.data],
  );
  const fields = useMemo(
    () =>
      getMaterialSpreadsheetFields(
        models,
        custodians,
        (id, values) => intl.formatMessage({ id }, values),
        groups,
        capitalSourcesQuery.data ?? [],
      ),
    [capitalSourcesQuery.data, custodians, groups, intl, models],
  );
  const exportFields = useMemo(
    () =>
      getMaterialSpreadsheetExportFields(fields, (id, values) =>
        intl.formatMessage({ id }, values),
      ),
    [fields, intl],
  );

  return {
    fields,
    exportFields,
    models,
    custodians,
    modelsQuery,
    custodiansQuery,
    capitalSourcesQuery,
  };
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
  const [importFooter, setImportFooter] = useState<ReactNode>(null);
  const handleImportFooterChange = useCallback(
    (footer: ReactNode | null) => setImportFooter(footer),
    [],
  );
  useEffect(() => {
    if (!open) setImportFooter(null);
  }, [open]);

  const { hasPermission } = useUser();
  const canCreateModels = hasPermission(
    'material_catalog:material_model:manage',
  );
  const groupsQuery = useMaterialGroupsQuery(open && canCreateModels);
  const {
    fields,
    models,
    custodians,
    modelsQuery,
    custodiansQuery,
    capitalSourcesQuery,
  } = useMaterialSpreadsheetOptions(open, groupsQuery.data ?? []);
  const specificationsQuery = useMaterialSpecificationsQuery(
    open && canCreateModels,
  );
  const catalogsLoading =
    modelsQuery.isPending ||
    custodiansQuery.isPending ||
    capitalSourcesQuery.isPending ||
    (canCreateModels &&
      (groupsQuery.isPending || specificationsQuery.isPending));
  const catalogsError =
    modelsQuery.isError ||
    custodiansQuery.isError ||
    capitalSourcesQuery.isError ||
    (canCreateModels && (groupsQuery.isError || specificationsQuery.isError));

  return (
    <MaterialSpreadsheetImportDialogShell
      open={open}
      onOpenChange={onOpenChange}
      footer={importFooter}
    >
      <CatalogState
        loading={catalogsLoading}
        error={catalogsError}
        onRetry={() => {
          void modelsQuery.refetch();
          void custodiansQuery.refetch();
          void capitalSourcesQuery.refetch();
          if (canCreateModels) {
            void groupsQuery.refetch();
            void specificationsQuery.refetch();
          }
        }}
      />
      {!catalogsLoading && !catalogsError ? (
        open ? (
          <MaterialSpreadsheetImportPanel
            open={open}
            onFooterChange={handleImportFooterChange}
            fields={fields}
            models={models}
            custodians={custodians}
            groups={groupsQuery.data ?? []}
            capitalSources={capitalSourcesQuery.data ?? []}
            specifications={specificationsQuery.data ?? []}
            canCreateModels={canCreateModels}
          />
        ) : null
      ) : null}
    </MaterialSpreadsheetImportDialogShell>
  );
}

export function MaterialSpreadsheetExportDialog({
  open,
  onOpenChange,
  filters,
}: MaterialSpreadsheetExportDialogProps) {
  const groupsQuery = useMaterialGroupsQuery(open);
  const { exportFields, modelsQuery, custodiansQuery, capitalSourcesQuery } =
    useMaterialSpreadsheetOptions(open, groupsQuery.data ?? []);
  const catalogsLoading =
    modelsQuery.isPending ||
    custodiansQuery.isPending ||
    capitalSourcesQuery.isPending ||
    groupsQuery.isPending;
  const catalogsError =
    modelsQuery.isError ||
    custodiansQuery.isError ||
    capitalSourcesQuery.isError ||
    groupsQuery.isError;
  const exportState = useMaterialSpreadsheetExport({
    open,
    filters,
    fields: exportFields,
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
            void capitalSourcesQuery.refetch();
            void groupsQuery.refetch();
          }}
        />
      ) : (
        <MaterialSpreadsheetExportPanel state={exportState} />
      )}
    </MaterialSpreadsheetExportDialogShell>
  );
}
