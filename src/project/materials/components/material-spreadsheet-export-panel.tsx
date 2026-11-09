import { useEffect, useState } from 'react';
import type { SpreadsheetTemplate } from '@/project/spreadsheets/api/spreadsheet-templates.api';
import { LoaderCircle } from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import {
  exportSpreadsheet,
  MAX_SPREADSHEET_ROWS,
  readXlsxFile,
  SpreadsheetError,
} from '@/lib/spreadsheets/xlsx';
import type {
  SpreadsheetField,
  SpreadsheetWorkbook,
} from '@/lib/spreadsheets/xlsx';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import { Progress } from '@/components/ui/progress';
import { loadMaterials } from '../api/materials.api';
import type { Material, MaterialListFilters } from '../model/material';
import { prepareMaterialExportMapping } from '../spreadsheet/material-spreadsheet';

type ExportScope = 'filtered' | 'all';
type ExportTemplateSource = 'system' | 'custom';
type ExportPhase = 'idle' | 'fetching' | 'writing' | 'complete' | 'failed';

interface ExportProgress {
  processed: number;
  total: number;
}

interface MaterialSpreadsheetExportOptions {
  open: boolean;
  filters: Omit<MaterialListFilters, 'page' | 'pageSize'>;
  fields: SpreadsheetField<Material>[];
  sharedTemplate: SpreadsheetTemplate | null;
  sharedTemplateLoading: boolean;
  sharedTemplateError: boolean;
  catalogsLoading: boolean;
  catalogsError: boolean;
}

export interface MaterialSpreadsheetExportState {
  scope: ExportScope;
  scopeOptions: SelectOption[];
  setScope: (scope: ExportScope) => void;
  templateSource: ExportTemplateSource;
  templateOptions: SelectOption[];
  setTemplateSource: (source: ExportTemplateSource) => void;
  customTemplateName: string;
  handleTemplate: (file?: File) => Promise<void>;
  fileLoading: boolean;
  templateLoading: boolean;
  exporting: boolean;
  exportDisabled: boolean;
  showProgress: boolean;
  percent: number;
  progressStatus: string;
  progressTone: 'primary' | 'success' | 'destructive';
  visibleError: string;
  handleExport: () => Promise<void>;
}

export function useMaterialSpreadsheetExport({
  open,
  filters,
  fields,
  sharedTemplate,
  sharedTemplateLoading,
  sharedTemplateError,
  catalogsLoading,
  catalogsError,
}: MaterialSpreadsheetExportOptions): MaterialSpreadsheetExportState {
  const intl = useIntl();
  const [scope, setScope] = useState<ExportScope>('filtered');
  const [templateSource, setTemplateSource] =
    useState<ExportTemplateSource>('system');
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [customWorkbook, setCustomWorkbook] =
    useState<SpreadsheetWorkbook | null>(null);
  const [error, setError] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [progress, setProgress] = useState<ExportProgress>({
    processed: 0,
    total: 0,
  });

  const scopeOptions: SelectOption[] = [
    {
      value: 'filtered',
      label: intl.formatMessage({
        id: 'project.materials.spreadsheet.filteredScope',
      }),
    },
    {
      value: 'all',
      label: intl.formatMessage({
        id: 'project.materials.spreadsheet.allScope',
      }),
    },
  ];
  const templateOptions: SelectOption[] = [
    {
      value: 'system',
      label: intl.formatMessage({
        id: 'project.materials.spreadsheet.exportTemplateSystem',
      }),
    },
    {
      value: 'custom',
      label: intl.formatMessage({
        id: 'project.materials.spreadsheet.exportTemplateCustom',
      }),
    },
  ];

  const workbook =
    templateSource === 'system'
      ? (sharedTemplate?.workbook ?? null)
      : customWorkbook;
  const templateName =
    templateSource === 'system'
      ? (sharedTemplate?.fileName ?? '')
      : customTemplateName;
  const systemTemplateError =
    templateSource === 'system' && !sharedTemplateLoading && !sharedTemplate
      ? intl.formatMessage({
          id: sharedTemplateError
            ? 'project.materials.spreadsheet.sharedTemplateLoadError'
            : 'project.materials.spreadsheet.sharedTemplateMissing',
        })
      : '';
  const visibleError = error || systemTemplateError;
  const percent =
    progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : 0;
  const progressStatus =
    phase === 'fetching'
      ? intl.formatMessage({
          id: 'project.materials.spreadsheet.exportFetchingData',
        })
      : phase === 'writing' || phase === 'complete'
        ? intl.formatMessage(
            { id: 'project.materials.spreadsheet.exportProgressCount' },
            {
              processed: progress.processed,
              total: progress.total,
            },
          )
        : '';

  useEffect(() => {
    if (open) return;
    setScope('filtered');
    setTemplateSource('system');
    setCustomTemplateName('');
    setCustomWorkbook(null);
    setError('');
    setFileLoading(false);
    setExporting(false);
    setPhase('idle');
    setProgress({ processed: 0, total: 0 });
  }, [open]);

  const handleTemplate = async (file?: File) => {
    setError('');
    if (!file) return;
    setFileLoading(true);
    try {
      const nextWorkbook = await readXlsxFile(file);
      setCustomTemplateName(file.name);
      setCustomWorkbook(nextWorkbook);
    } catch (caught) {
      setError(getErrorText(caught, intl.formatMessage));
    } finally {
      setFileLoading(false);
    }
  };

  const handleExport = async () => {
    setError('');
    setPhase('fetching');
    setProgress({ processed: 0, total: 0 });
    setExporting(true);
    try {
      if (!workbook) {
        throw new SpreadsheetError(
          templateSource === 'custom'
            ? 'project.materials.spreadsheet.customTemplateRequired'
            : sharedTemplateError
              ? 'project.materials.spreadsheet.sharedTemplateLoadError'
              : 'project.materials.spreadsheet.sharedTemplateMissing',
        );
      }

      const exportFilters = scope === 'all' ? {} : filters;
      const records = await loadAllMaterials(exportFilters, setProgress);
      if (records.length === 0) {
        throw new SpreadsheetError('project.materials.empty.list');
      }
      if (records.length > MAX_SPREADSHEET_ROWS) {
        throw new SpreadsheetError('common.spreadsheets.errors.exportLimit');
      }

      setPhase('writing');
      setProgress({ processed: 0, total: records.length });
      const mapping = prepareMaterialExportMapping(
        workbook,
        fields,
        templateSource === 'system',
      );
      if (!mapping || Object.keys(mapping.columnByFieldKey).length === 0) {
        throw new SpreadsheetError('common.spreadsheets.errors.mappingEmpty');
      }

      await exportSpreadsheet({
        fields,
        records,
        fileName: templateName
          ? `${templateName.replace(/\.xlsx$/i, '')}_export.xlsx`
          : 'vat-tu.xlsx',
        workbook,
        mapping,
      });
      setProgress({ processed: records.length, total: records.length });
      setPhase('complete');
      toast.success(
        intl.formatMessage(
          { id: 'project.materials.spreadsheet.exportedCount' },
          { count: records.length },
        ),
      );
    } catch (caught) {
      setPhase('failed');
      setError(getErrorText(caught, intl.formatMessage));
    } finally {
      setExporting(false);
    }
  };

  const exportDisabled =
    exporting ||
    fileLoading ||
    catalogsLoading ||
    catalogsError ||
    (templateSource === 'system'
      ? sharedTemplateLoading || !sharedTemplate
      : !customWorkbook);

  return {
    scope,
    scopeOptions,
    setScope,
    templateSource,
    templateOptions,
    setTemplateSource: (source) => {
      setTemplateSource(source);
      setError('');
    },
    customTemplateName,
    handleTemplate,
    fileLoading,
    templateLoading: sharedTemplateLoading || catalogsLoading,
    exporting,
    exportDisabled,
    showProgress: phase !== 'idle',
    percent,
    progressStatus,
    progressTone:
      phase === 'complete'
        ? 'success'
        : phase === 'failed'
          ? 'destructive'
          : 'primary',
    visibleError,
    handleExport,
  };
}

export function MaterialSpreadsheetExportPanel({
  state,
}: {
  state: MaterialSpreadsheetExportState;
}) {
  const intl = useIntl();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[8.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
        <Label
          className="pt-2"
          variant="secondary"
          htmlFor="material-export-scope"
        >
          {intl.formatMessage({ id: 'project.materials.spreadsheet.scope' })}
        </Label>
        <OptionSelect
          id="material-export-scope"
          options={state.scopeOptions}
          value={state.scope}
          onChange={(value) => state.setScope(value as ExportScope)}
          searchable={false}
          disabled={state.exporting}
        />
      </div>

      <div className="grid grid-cols-[8.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
        <Label
          className="pt-2"
          variant="secondary"
          htmlFor="material-export-template-source"
        >
          {intl.formatMessage({
            id: 'project.materials.spreadsheet.exportTemplate',
          })}
        </Label>
        <div className="min-w-0 space-y-2">
          <OptionSelect
            id="material-export-template-source"
            options={state.templateOptions}
            value={state.templateSource}
            onChange={(value) =>
              state.setTemplateSource(value as ExportTemplateSource)
            }
            searchable={false}
            disabled={state.exporting}
          />
          {state.templateSource === 'custom' ? (
            <div className="space-y-1">
              <Input
                id="material-export-custom-template"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={state.exporting || state.fileLoading}
                aria-label={intl.formatMessage({
                  id: 'project.materials.spreadsheet.chooseFile',
                })}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  void state.handleTemplate(file);
                }}
              />
              {state.customTemplateName ? (
                <p className="text-xs text-muted-foreground">
                  {state.customTemplateName}
                </p>
              ) : null}
            </div>
          ) : null}
          {((state.templateSource === 'system' && state.templateLoading) ||
            state.fileLoading) && (
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              role="status"
            >
              <LoaderCircle className="size-4 animate-spin" />
              {intl.formatMessage({ id: 'common.state.loading' })}
            </div>
          )}
        </div>
      </div>

      {state.showProgress ? (
        <div
          className="space-y-2"
          aria-label={intl.formatMessage({
            id: 'project.materials.spreadsheet.exportProgress',
          })}
        >
          <Progress
            value={state.percent}
            aria-label={`${state.percent}%`}
            indicatorClassName={
              state.progressTone === 'success'
                ? 'bg-[var(--color-success-accent,var(--color-green-600))]'
                : state.progressTone === 'destructive'
                  ? 'bg-destructive'
                  : undefined
            }
          />
          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>{state.progressStatus}</span>
            <span className="shrink-0 tabular-nums">{state.percent}%</span>
          </div>
        </div>
      ) : null}

      {state.visibleError ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {state.visibleError}
        </p>
      ) : null}
    </div>
  );
}

async function loadAllMaterials(
  filters: Omit<MaterialListFilters, 'page' | 'pageSize'>,
  onProgress: (progress: ExportProgress) => void,
): Promise<Material[]> {
  const pageSize = 100;
  const firstPage = await loadMaterials(
    { ...filters, page: 1, pageSize },
    undefined,
    { resolveImages: false },
  );
  onProgress({ processed: firstPage.items.length, total: firstPage.total });
  if (firstPage.total > MAX_SPREADSHEET_ROWS) {
    throw new SpreadsheetError('common.spreadsheets.errors.exportLimit');
  }

  const materials = [...firstPage.items];
  const pageCount = Math.ceil(firstPage.total / pageSize);
  for (let page = 2; page <= pageCount; page += 1) {
    const result = await loadMaterials(
      { ...filters, page, pageSize },
      undefined,
      { resolveImages: false },
    );
    materials.push(...result.items);
    onProgress({ processed: materials.length, total: firstPage.total });
  }
  return materials;
}

function getErrorText(
  error: unknown,
  formatMessage: (descriptor: { id: string }) => string,
): string {
  if (error instanceof SpreadsheetError)
    return formatMessage({ id: error.message });
  return error instanceof Error ? error.message : String(error);
}
