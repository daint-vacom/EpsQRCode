import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Custodian } from '@/project/custodians/model/custodian';
import type { MaterialGroup } from '@/project/material-groups/model/material-group';
import {
  useCreateMaterialModelsBulkMutation,
  useUpdateMaterialModelLinkedCodesMutation,
} from '@/project/material-models/hooks/use-material-models';
import type { MaterialModel } from '@/project/material-models/model/material-model';
import type { MaterialSpecification } from '@/project/material-specifications/model/material-specification';
import { loadSpreadsheetTemplate } from '@/project/spreadsheets/api/spreadsheet-templates.api';
import { useSpreadsheetTemplatesQuery } from '@/project/spreadsheets/hooks/use-spreadsheet-templates';
import {
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
  type RowSelectionState,
} from '@tanstack/react-table';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  LoaderCircle,
  Upload,
  X,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import {
  MAX_SPREADSHEET_FILE_BYTES,
  readMappedRows,
  readXlsxFile,
  SpreadsheetError,
  type SpreadsheetField,
} from '@/lib/spreadsheets/xlsx';
import { useUser } from '@/providers/user-provider';
import { Button } from '@/components/ui/button';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  FileUploadContent,
  type FileUploadContentHandle,
} from '@/components/ui/file-upload/file-upload-content';
import { FileIcon } from '@/components/ui/files/file-icon';
import { OptionSelect } from '@/components/ui/option-select';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCreateMaterialsBulkMutation } from '../hooks/use-materials';
import type { Material } from '../model/material';
import type { MaterialCapitalSource } from '../model/material-capital-source';
import {
  buildMaterialModelImportProposals,
  findMaterialImportMapping,
  getMaterialImportCodes,
  getMissingMaterialImportFields,
  groupMaterialImportPreviewRows,
  isMaterialImportExampleRow,
  mapMaterialSpreadsheetRows,
  readMaterialImportLinkedCodes,
  toMaterialImportPreviewRows,
  type MaterialSpreadsheetImportPreviewRow,
  type MaterialSpreadsheetSource,
} from '../spreadsheet/material-spreadsheet-import';
import {
  createMaterialImportReport,
  type MaterialImportOutcome,
} from '../spreadsheet/material-spreadsheet-import-report';
import { prepareMaterialImportTemplate } from '../spreadsheet/material-spreadsheet-template';
import {
  MATERIAL_SPREADSHEET_IMPORT_PREVIEW_ROW_COLUMN_PINNING,
  useMaterialSpreadsheetImportPreviewRowColumns,
} from '../table/material-spreadsheet-import-preview.columns.generated';

type ImportMode = 'existing' | 'create';

interface MaterialSpreadsheetImportPanelProps {
  open: boolean;
  onFooterChange: (footer: ReactNode | null) => void;
  onStepChange: (step: number) => void;
  fields: SpreadsheetField<Material>[];
  models: MaterialModel[];
  custodians: Custodian[];
  groups: MaterialGroup[];
  capitalSources: MaterialCapitalSource[];
  specifications: MaterialSpecification[];
  canCreateModels: boolean;
  catalogsLoading: boolean;
  catalogsError: boolean;
  onRetryCatalogs: () => void;
}

interface MaterialImportProgress {
  processed: number;
  total: number;
}

const EMPTY_SOURCES: MaterialSpreadsheetSource[] = [];

export function MaterialSpreadsheetImportPanel({
  open,
  onFooterChange,
  onStepChange,
  fields,
  models,
  custodians,
  groups,
  capitalSources,
  specifications,
  canCreateModels,
  catalogsLoading,
  catalogsError,
  onRetryCatalogs,
}: MaterialSpreadsheetImportPanelProps) {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const templatesQuery = useSpreadsheetTemplatesQuery('materialsImport', open);
  const templates = templatesQuery.data ?? [];
  const createMutation = useCreateMaterialsBulkMutation();
  const createModelMutation = useCreateMaterialModelsBulkMutation();
  const updateModelLinkedCodesMutation =
    useUpdateMaterialModelLinkedCodesMutation();
  const fileUploadRef = useRef<FileUploadContentHandle>(null);
  const pendingFilesRef = useRef<MaterialSpreadsheetSource[]>([]);
  const canManageModels =
    canCreateModels && hasPermission('material_catalog:material_model:manage');
  const [step, setStep] = useState(1);
  const [highestStep, setHighestStep] = useState(1);
  const [importMode, setImportMode] = useState<ImportMode>('existing');
  const [sources, setSources] = useState<MaterialSpreadsheetSource[]>([]);
  const [fileReading, setFileReading] = useState(false);
  const [waitingForCatalogsCount, setWaitingForCatalogsCount] = useState(0);
  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<MaterialImportProgress>({
    processed: 0,
    total: 0,
  });
  const [importStage, setImportStage] = useState('');
  const [outcomes, setOutcomes] = useState<MaterialImportOutcome[] | null>(
    null,
  );
  const [reportDownloading, setReportDownloading] = useState<
    'all' | 'errors' | null
  >(null);
  const [reportError, setReportError] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [groupingEnabled, setGroupingEnabled] = useState(false);
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ??
    templates[0] ??
    null;

  const translate = useCallback(
    (id: string, values?: Record<string, string>) =>
      intl.formatMessage({ id }, values),
    [intl],
  );
  const templateOptions = templates.map((template) => ({
    value: template.id,
    label: template.isBundled
      ? `${template.fileName} · ${translate('settings.spreadsheetTemplates.defaultTemplate')}`
      : template.fileName,
  }));

  useEffect(() => {
    if (open) return;
    setStep(1);
    setHighestStep(1);
    setImportMode('existing');
    setSources(EMPTY_SOURCES);
    setFileReading(false);
    pendingFilesRef.current = [];
    setWaitingForCatalogsCount(0);
    setTemplateDownloading(false);
    setSelectedTemplateId('');
    setTemplateError('');
    setUploadError('');
    setImporting(false);
    setImportProgress({ processed: 0, total: 0 });
    setImportStage('');
    setOutcomes(null);
    setReportDownloading(null);
    setReportError('');
    setPagination({ pageIndex: 0, pageSize: 20 });
    setGroupingEnabled(false);
  }, [open]);

  const sourceRows = useMemo(
    () => sources.flatMap((source) => source.rows),
    [sources],
  );
  const modelProposals = useMemo(
    () =>
      buildMaterialModelImportProposals(
        sourceRows,
        models,
        groups,
        specifications,
        translate,
      ),
    [groups, models, sourceRows, specifications, translate],
  );
  const activeProposals = useMemo(
    () => (importMode === 'create' ? modelProposals : []),
    [importMode, modelProposals],
  );
  const mappedRows = useMemo(
    () =>
      mapMaterialSpreadsheetRows(
        sources,
        models,
        custodians,
        fields,
        translate,
        activeProposals,
        capitalSources,
      ),
    [
      activeProposals,
      capitalSources,
      custodians,
      fields,
      models,
      sources,
      translate,
    ],
  );
  const previewRows = useMemo(() => {
    const rows = toMaterialImportPreviewRows(
      mappedRows,
      models,
      modelProposals,
    );
    return rows.map((row) => ({
      ...row,
      name: row.name || row.modelName,
      ownerName: row.ownerName || row.ownerCode,
    }));
  }, [mappedRows, modelProposals, models]);
  const rowErrors = mappedRows.filter((row) => Boolean(row.error));
  const globalErrors = useMemo(
    () =>
      sources.flatMap((source) =>
        source.globalErrors.map((error, index) => ({
          id: `${source.id}:global:${index}`,
          sourceId: source.id,
          fileName: source.file.name,
          rowNumber: null as number | null,
          error,
        })),
      ),
    [sources],
  );
  const validationErrorCount = globalErrors.length + rowErrors.length;
  const previewTableRows = useMemo<MaterialSpreadsheetImportPreviewRow[]>(
    () => [
      ...previewRows,
      ...globalErrors.map((error) => ({
        id: error.id,
        sourceId: error.sourceId,
        fileName: error.fileName,
        excelRow: error.rowNumber,
        code: '',
        quantity: 0,
        modelCode: '',
        modelName: '',
        name: '',
        description: '',
        serialNumber: '',
        condition: '',
        materialGroupKey: `invalid:${error.id}`,
        specifications: '',
        ownerCode: '',
        ownerName: '',
        note: '',
        isValid: false,
        error: error.error,
      })),
    ],
    [globalErrors, previewRows],
  );
  const groupedPreviewRows = useMemo(
    () =>
      groupingEnabled ? groupMaterialImportPreviewRows(previewTableRows) : [],
    [groupingEnabled, previewTableRows],
  );
  const tableRows = groupingEnabled ? groupedPreviewRows : previewTableRows;
  const previewColumns = useMaterialSpreadsheetImportPreviewRowColumns(
    sources.length > 1,
  );
  const previewTable = useReactTable({
    data: tableRows,
    columns: previewColumns,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.subRows,
    enableRowSelection: (row) =>
      row.original.groupSummary
        ? row.original.groupSummary.validRowCount > 0
        : row.original.isValid,
    state: {
      pagination,
      rowSelection,
      columnPinning: MATERIAL_SPREADSHEET_IMPORT_PREVIEW_ROW_COLUMN_PINNING,
    },
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  useEffect(() => {
    setRowSelection((current) => {
      const next: RowSelectionState = {};
      let unchanged = true;
      for (const row of mappedRows) {
        if (row.values !== null && !row.error) {
          const selected = current[row.id] ?? true;
          next[row.id] = selected;
          if (current[row.id] !== selected) unchanged = false;
        }
      }
      if (Object.keys(current).length !== Object.keys(next).length) {
        unchanged = false;
      }
      return unchanged ? current : next;
    });
  }, [mappedRows]);
  useEffect(() => onStepChange(step), [onStepChange, step]);
  const validRowCount = mappedRows.filter(
    (row) => row.values !== null && !row.error,
  ).length;
  const invalidRowCount = validationErrorCount;
  const selectedRows = mappedRows.filter(
    (row) => rowSelection[row.id] === true,
  );
  const selectedModelCodes = new Set(
    selectedRows.map((row) => normalizeModelCode(row.modelCode)),
  );
  const selectedModelProposals = modelProposals.filter((proposal) =>
    selectedModelCodes.has(normalizeModelCode(proposal.code)),
  );
  const selectedMaterialCount = selectedRows.reduce(
    (total, row) =>
      row.values !== null && !row.error ? total + row.quantity : total,
    0,
  );
  const proposalErrors = canManageModels
    ? modelProposals.filter((proposal) => proposal.error)
    : [];
  const canCreateAllModels =
    canManageModels &&
    selectedModelProposals.length > 0 &&
    selectedModelProposals.every(
      (proposal) => Boolean(proposal.formValues) && !proposal.error,
    );
  const importFailureCount =
    outcomes?.reduce(
      (total, outcome) => total + outcome.quantity - outcome.createdCount,
      0,
    ) ?? 0;
  const importPercent =
    importProgress.total > 0
      ? Math.min(
          100,
          Math.round((importProgress.processed / importProgress.total) * 100),
        )
      : outcomes
        ? 100
        : 0;
  const hasReportErrors =
    Boolean(outcomes?.some((outcome) => !outcome.success)) ||
    sources.some((source) => source.globalErrors.length > 0);

  const processFiles = useCallback(
    async (files: MaterialSpreadsheetSource[]) => {
      setFileReading(true);
      setWaitingForCatalogsCount(0);
      for (const source of files) {
        try {
          const workbook = await readXlsxFile(source.file);
          const mapping = findMaterialImportMapping(workbook, fields);
          source.workbook = workbook;
          source.mapping = mapping;
          source.worksheetName = mapping?.worksheetName ?? null;
          if (!mapping) {
            source.globalErrors.push(
              translate('project.materials.spreadsheet.templateMappingMissing'),
            );
          } else {
            const missingFields = getMissingMaterialImportFields(
              mapping,
              translate,
            );
            if (missingFields.length > 0) {
              source.globalErrors.push(
                translate(
                  'project.materials.spreadsheet.templateMissingFields',
                  {
                    fields: missingFields.join(', '),
                  },
                ),
              );
            }
            const worksheet = workbook.getWorksheet(mapping.worksheetName);
            if (!worksheet) {
              source.globalErrors.push(
                translate('common.spreadsheets.errors.worksheetMissing'),
              );
            } else if (missingFields.length === 0) {
              source.rows = readMappedRows(
                worksheet,
                mapping,
                fields.map((field) => field.key),
              ).filter((row) => !isMaterialImportExampleRow(row));
              const linkedCodes = readMaterialImportLinkedCodes(
                workbook,
                mapping,
                source.rows,
                (id, values) => translate(id, values),
              );
              source.rows =
                linkedCodes.errors.length > 0 ? [] : linkedCodes.rows;
              source.globalErrors.push(...linkedCodes.errors);
              if (source.rows.length === 0) {
                source.globalErrors.push(
                  translate('project.materials.spreadsheet.templateNoRows'),
                );
              }
            }
          }
        } catch (error) {
          source.globalErrors.push(getErrorText(error, translate));
        }
        source.status = source.globalErrors.length > 0 ? 'error' : 'success';
        setSources((current) =>
          current.map((item) => (item.id === source.id ? { ...source } : item)),
        );
      }
      setFileReading(false);
    },
    [fields, translate],
  );

  const handleReadFiles = useCallback(
    async (files: File[]) => {
      const existingFileKeys = new Set(
        [
          ...sources.map((source) => source.file),
          ...pendingFilesRef.current.map((source) => source.file),
        ].map(fileKey),
      );
      const uniqueFiles = files.filter(
        (file) => !existingFileKeys.has(fileKey(file)),
      );
      setUploadError('');
      if (uniqueFiles.length === 0) {
        setUploadError(
          translate('project.materials.spreadsheet.duplicateUploadFiles'),
        );
        return;
      }

      const newSources: MaterialSpreadsheetSource[] = uniqueFiles.map(
        (file) => ({
          id: crypto.randomUUID(),
          file,
          status: 'reading',
          workbook: null,
          worksheetName: null,
          mapping: null,
          rows: [],
          globalErrors: [],
        }),
      );
      setSources((current) => [...current, ...newSources]);

      if (catalogsLoading || catalogsError) {
        pendingFilesRef.current = [...pendingFilesRef.current, ...newSources];
        setWaitingForCatalogsCount(pendingFilesRef.current.length);
        return;
      }

      await processFiles(newSources);
    },
    [catalogsError, catalogsLoading, processFiles, sources, translate],
  );

  useEffect(() => {
    if (catalogsLoading || catalogsError || fileReading) return;
    if (pendingFilesRef.current.length === 0) return;
    const pendingFiles = pendingFilesRef.current;
    pendingFilesRef.current = [];
    void processFiles(pendingFiles);
  }, [catalogsError, catalogsLoading, fileReading, processFiles]);

  const handleDownloadTemplate = async () => {
    setTemplateError('');
    if (!selectedTemplate) return;
    setTemplateDownloading(true);
    try {
      const template = await loadSpreadsheetTemplate(
        'materialsImport',
        selectedTemplate.id,
      );
      prepareMaterialImportTemplate(template.workbook, fields, (id) =>
        translate(id),
      );
      const buffer = await template.workbook.xlsx.writeBuffer();
      const importFileName = template.fileName.match(/xuất/i)
        ? template.fileName.replace(/xuất/i, 'nhập')
        : template.fileName.match(/xuat/i)
          ? template.fileName.replace(/xuat/i, 'nhap')
          : /nhập|nhap/i.test(template.fileName)
            ? template.fileName
            : template.fileName.replace(/\.xlsx$/i, '_nhap.xlsx');
      downloadBlob(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        importFileName,
      );
    } catch (error) {
      setTemplateError(getErrorText(error, translate));
    } finally {
      setTemplateDownloading(false);
    }
  };

  const handleImport = async () => {
    if (selectedRows.length === 0 || importing || outcomes) return;
    setStep(3);
    setHighestStep(3);
    setImporting(true);
    setReportError('');
    const outcomeById = new Map<string, MaterialImportOutcome>();
    const invalidRows = selectedRows.filter(
      (row) => row.values === null || Boolean(row.error),
    );
    for (const row of invalidRows) {
      outcomeById.set(row.id, {
        id: row.id,
        sourceId: row.sourceId,
        rowNumber: row.rowNumber,
        code: row.code,
        success: false,
        quantity: row.quantity,
        createdCount: 0,
        error:
          row.error ||
          translate('project.materials.spreadsheet.errors.formInvalid'),
      });
    }
    const totalItemCount = selectedRows.reduce(
      (total, row) => total + row.quantity,
      0,
    );
    let completedCount = invalidRows.reduce(
      (total, row) => total + row.quantity,
      0,
    );
    setImportProgress({ processed: completedCount, total: totalItemCount });
    const modelIdByCode = new Map<string, string>();

    try {
      if (importMode === 'create') {
        const proposalsToCreate = modelProposals.filter(
          (proposal) =>
            proposal.formValues &&
            !proposal.error &&
            selectedRows.some(
              (row) =>
                row.values !== null &&
                !row.error &&
                normalizeModelCode(row.modelCode) ===
                  normalizeModelCode(proposal.code),
            ),
        );
        for (let start = 0; start < proposalsToCreate.length; start += 100) {
          const batch = proposalsToCreate.slice(start, start + 100);
          setImportStage(
            translate('project.materials.spreadsheet.creatingModelProgress', {
              processed: String(start + batch.length),
              total: String(proposalsToCreate.length),
            }),
          );
          try {
            const results = await createModelMutation.mutateAsync(
              batch.map((proposal) => proposal.formValues!),
            );
            batch.forEach((proposal, index) => {
              const result = results[index];
              if (result?.success && result.id) {
                modelIdByCode.set(normalizeModelCode(proposal.code), result.id);
                return;
              }
              const message =
                result?.error ||
                translate(
                  'project.materials.spreadsheet.errors.modelCreateFailed',
                );
              for (const row of selectedRows) {
                if (
                  normalizeModelCode(row.modelCode) !==
                    normalizeModelCode(proposal.code) ||
                  row.values === null ||
                  row.error
                )
                  continue;
                outcomeById.set(row.id, {
                  id: row.id,
                  sourceId: row.sourceId,
                  rowNumber: row.rowNumber,
                  code: row.code,
                  success: false,
                  quantity: row.quantity,
                  createdCount: 0,
                  error: message,
                });
                completedCount += row.quantity;
              }
            });
          } catch (error) {
            const message = getErrorText(error, translate);
            for (const proposal of batch) {
              for (const row of selectedRows) {
                if (
                  normalizeModelCode(row.modelCode) !==
                    normalizeModelCode(proposal.code) ||
                  row.values === null ||
                  row.error
                )
                  continue;
                outcomeById.set(row.id, {
                  id: row.id,
                  sourceId: row.sourceId,
                  rowNumber: row.rowNumber,
                  code: row.code,
                  success: false,
                  quantity: row.quantity,
                  createdCount: 0,
                  error: message,
                });
                completedCount += row.quantity;
              }
            }
          }
          setImportProgress({
            processed: completedCount,
            total: totalItemCount,
          });
        }
      }

      const linkedCodeUpdates = new Map<
        string,
        { id: string; linkedCodes: MaterialModel['linkedCodes'] }
      >();
      for (const row of selectedRows) {
        if (
          row.values === null ||
          row.error ||
          row.modelLinkedCodes.length === 0
        ) {
          continue;
        }
        if (modelIdByCode.has(normalizeModelCode(row.modelCode))) continue;
        const model = models.find(
          (item) =>
            normalizeModelCode(item.code) === normalizeModelCode(row.modelCode),
        );
        if (!model) continue;
        const key = normalizeModelCode(model.code);
        const existing =
          linkedCodeUpdates.get(key)?.linkedCodes ?? model.linkedCodes;
        const codes = new Map(
          existing.map((item) => [normalizeModelCode(item.value), item]),
        );
        row.modelLinkedCodes.forEach((item) => {
          codes.set(normalizeModelCode(item.value), item);
        });
        linkedCodeUpdates.set(key, {
          id: model.id,
          linkedCodes: Array.from(codes.values()),
        });
      }
      for (const [modelCode, update] of linkedCodeUpdates) {
        try {
          await updateModelLinkedCodesMutation.mutateAsync(update);
        } catch (error) {
          const message = getErrorText(error, translate);
          for (const row of selectedRows) {
            if (
              normalizeModelCode(row.modelCode) !== modelCode ||
              row.values === null ||
              row.error ||
              row.modelLinkedCodes.length === 0
            )
              continue;
            outcomeById.set(row.id, {
              id: row.id,
              sourceId: row.sourceId,
              rowNumber: row.rowNumber,
              code: row.code,
              success: false,
              quantity: row.quantity,
              createdCount: 0,
              error: message,
            });
            completedCount += row.quantity;
          }
        }
      }

      const importableRows = selectedRows.filter(
        (row) => row.values !== null && !row.error && !outcomeById.has(row.id),
      );
      const rowsWithResolvedModelIds = importableRows.flatMap((row) => {
        if (!row.values) return [];
        const modelId = modelIdByCode.get(normalizeModelCode(row.modelCode));
        if (row.values.modelId.startsWith('pending:') && !modelId) {
          outcomeById.set(row.id, {
            id: row.id,
            sourceId: row.sourceId,
            rowNumber: row.rowNumber,
            code: row.code,
            success: false,
            quantity: row.quantity,
            createdCount: 0,
            error: translate(
              'project.materials.spreadsheet.errors.modelCreateFailed',
            ),
          });
          completedCount += row.quantity;
          return [];
        }
        return [
          {
            row,
            values: {
              ...row.values,
              modelId: modelId ?? row.values.modelId,
            },
          },
        ];
      });
      setImportProgress({
        processed: completedCount,
        total: totalItemCount,
      });

      const materialRows = rowsWithResolvedModelIds.flatMap(({ row, values }) =>
        getMaterialImportCodes(row.code, row.quantity).map((code) => ({
          row,
          values: { ...values, code },
        })),
      );
      const resultStatsByRow = new Map<
        string,
        { createdCount: number; error: string; generatedCodes: string[] }
      >(
        rowsWithResolvedModelIds.map(({ row }) => [
          row.id,
          { createdCount: 0, error: '', generatedCodes: [] },
        ]),
      );

      for (let start = 0; start < materialRows.length; start += 100) {
        const batch = materialRows.slice(start, start + 100);
        setImportStage('');
        try {
          const results = await createMutation.mutateAsync(
            batch.map((item) => item.values),
          );
          batch.forEach(({ row }, index) => {
            const result = results[index];
            const stats = resultStatsByRow.get(row.id);
            if (!stats) return;
            if (result?.success) {
              stats.createdCount += 1;
              if (!row.code && result.code) {
                stats.generatedCodes.push(result.code);
              }
            } else if (!stats.error) {
              stats.error =
                result?.error ||
                translate('project.materials.spreadsheet.errors.formInvalid');
            }
          });
        } catch (error) {
          const message = getErrorText(error, translate);
          batch.forEach(({ row }) => {
            const stats = resultStatsByRow.get(row.id);
            if (stats && !stats.error) stats.error = message;
          });
        }
        completedCount += batch.length;
        setImportProgress({
          processed: completedCount,
          total: totalItemCount,
        });
      }

      for (const { row } of rowsWithResolvedModelIds) {
        const stats = resultStatsByRow.get(row.id);
        const createdCount = stats?.createdCount ?? 0;
        const success = createdCount === row.quantity;
        outcomeById.set(row.id, {
          id: row.id,
          sourceId: row.sourceId,
          rowNumber: row.rowNumber,
          code:
            row.code || summarizeGeneratedCodes(stats?.generatedCodes ?? []),
          success,
          quantity: row.quantity,
          createdCount,
          error: success
            ? ''
            : stats?.error ||
              translate('project.materials.spreadsheet.errors.formInvalid'),
        });
      }

      const finalOutcomes = selectedRows.map(
        (row) =>
          outcomeById.get(row.id) ?? {
            id: row.id,
            sourceId: row.sourceId,
            rowNumber: row.rowNumber,
            code: row.code,
            success: false,
            quantity: row.quantity,
            createdCount: 0,
            error: translate(
              'project.materials.spreadsheet.errors.formInvalid',
            ),
          },
      );
      setOutcomes(finalOutcomes);
      setImportProgress({
        processed: totalItemCount,
        total: totalItemCount,
      });
    } catch (error) {
      const message = getErrorText(error, translate);
      const finalOutcomes = selectedRows.map(
        (row) =>
          outcomeById.get(row.id) ?? {
            id: row.id,
            sourceId: row.sourceId,
            rowNumber: row.rowNumber,
            code: row.code,
            success: false,
            quantity: row.quantity,
            createdCount: 0,
            error: message,
          },
      );
      setOutcomes(finalOutcomes);
      setImportProgress({
        processed: totalItemCount,
        total: totalItemCount,
      });
    } finally {
      setImporting(false);
      setImportStage('');
    }
  };

  const handleDownloadReport = async (onlyErrors: boolean) => {
    if (!outcomes) return;
    setReportError('');
    setReportDownloading(onlyErrors ? 'errors' : 'all');
    try {
      const result = await createMaterialImportReport(
        sources,
        outcomes,
        onlyErrors,
        (id) => translate(id),
      );
      downloadBlob(result.blob, result.fileName);
    } catch (error) {
      setReportError(getErrorText(error, translate));
    } finally {
      setReportDownloading(null);
    }
  };

  const goToStep = (nextStep: number) => {
    if (nextStep > highestStep || importing) return;
    setStep(nextStep);
  };

  const progressColor =
    importFailureCount > 0
      ? 'bg-destructive'
      : 'bg-[var(--color-success-accent,var(--color-green-600))]';

  const footerActionsRef = useRef<{
    goToStep: (nextStep: number) => void;
    import: () => void;
    downloadReport: (onlyErrors: boolean) => void;
  }>({
    goToStep: () => {},
    import: () => {},
    downloadReport: () => {},
  });
  footerActionsRef.current = {
    goToStep,
    import: () => void handleImport(),
    downloadReport: (onlyErrors) => void handleDownloadReport(onlyErrors),
  };
  const footer = useMemo<ReactNode>(() => {
    if (step === 1) {
      return (
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={sources.length === 0 || fileReading}
          onClick={() => {
            setStep(2);
            setHighestStep(2);
          }}
        >
          {translate('project.materials.spreadsheet.nextStep')}
          <ArrowRight />
        </Button>
      );
    }

    if (step === 2) {
      return (
        <>
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={importing}
            onClick={() => footerActionsRef.current.goToStep(1)}
          >
            <ArrowLeft />
            {translate('project.materials.spreadsheet.backStep')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={
              previewRows.length === 0 ||
              selectedMaterialCount === 0 ||
              importing ||
              outcomes !== null ||
              (importMode === 'create' &&
                selectedModelProposals.length > 0 &&
                !canCreateAllModels)
            }
            loading={importing}
            loadingText={translate('project.materials.spreadsheet.importing')}
            onClick={() => footerActionsRef.current.import()}
          >
            <Upload />
            {translate('project.materials.spreadsheet.importNowWithCount', {
              count: String(selectedMaterialCount),
            })}
          </Button>
        </>
      );
    }

    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={!outcomes || importing || reportDownloading !== null}
          loading={reportDownloading === 'all'}
          loadingText={translate(
            'project.materials.spreadsheet.downloadingFile',
          )}
          onClick={() => footerActionsRef.current.downloadReport(false)}
        >
          <Download />
          {translate('project.materials.spreadsheet.downloadAllResults')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={
            !outcomes ||
            !hasReportErrors ||
            importing ||
            reportDownloading !== null
          }
          loading={reportDownloading === 'errors'}
          loadingText={translate(
            'project.materials.spreadsheet.downloadingFile',
          )}
          onClick={() => footerActionsRef.current.downloadReport(true)}
        >
          <Download />
          {translate('project.materials.spreadsheet.downloadErrorResults')}
        </Button>
      </>
    );
  }, [
    canCreateAllModels,
    fileReading,
    hasReportErrors,
    importing,
    importMode,
    outcomes,
    previewRows.length,
    reportDownloading,
    sources.length,
    step,
    translate,
    selectedMaterialCount,
    selectedModelProposals.length,
  ]);

  useEffect(() => {
    onFooterChange(footer);
  }, [footer, onFooterChange]);

  useEffect(() => () => onFooterChange(null), [onFooterChange]);

  return (
    <div className={step === 2 ? 'flex h-full min-h-0 flex-col' : 'space-y-5'}>
      <Stepper
        value={step}
        onValueChange={goToStep}
        className={
          step === 2 ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-4'
        }
      >
        <StepperNav className="shrink-0 gap-2">
          {[1, 2, 3].map((stepNumber) => (
            <StepperItem
              key={stepNumber}
              step={stepNumber}
              disabled={stepNumber > highestStep || importing}
              className="min-w-0"
            >
              <StepperTrigger className="rounded-md px-2 py-1.5 text-start">
                <StepperIndicator>{stepNumber}</StepperIndicator>
                <StepperTitle className="truncate">
                  {translate(
                    `project.materials.spreadsheet.importStep.${stepNumber === 1 ? 'upload' : stepNumber === 2 ? 'review' : 'report'}`,
                  )}
                </StepperTitle>
              </StepperTrigger>
              {stepNumber < 3 ? <StepperSeparator /> : null}
            </StepperItem>
          ))}
        </StepperNav>

        <StepperContent value={1} className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <OptionSelect
              id="material-import-template"
              ariaLabel={translate(
                'project.materials.spreadsheet.importTemplate',
              )}
              className="min-w-0 flex-1 sm:max-w-md"
              options={templateOptions}
              value={selectedTemplate?.id ?? ''}
              placeholder={
                templatesQuery.isPending
                  ? translate('common.state.loading')
                  : translate(
                      'project.materials.spreadsheet.importTemplateEmpty',
                    )
              }
              searchable={false}
              loading={templatesQuery.isPending}
              disabled={
                templatesQuery.isPending ||
                templatesQuery.isError ||
                templates.length === 0 ||
                templateDownloading
              }
              onChange={setSelectedTemplateId}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  mode="icon"
                  size="icon"
                  aria-label={translate(
                    'project.materials.spreadsheet.downloadImportTemplate',
                  )}
                  aria-busy={templateDownloading}
                  disabled={
                    templatesQuery.isPending ||
                    templatesQuery.isError ||
                    !selectedTemplate ||
                    templateDownloading
                  }
                  onClick={() => void handleDownloadTemplate()}
                >
                  {templateDownloading ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Download />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {translate(
                  'project.materials.spreadsheet.downloadImportTemplate',
                )}
              </TooltipContent>
            </Tooltip>
          </div>

          {templatesQuery.isError ? (
            <div className="flex items-center gap-2 text-sm" role="alert">
              <span className="min-w-0 flex-1 text-destructive">
                {getErrorText(templatesQuery.error, translate)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void templatesQuery.refetch()}
              >
                {translate('common.actions.retry')}
              </Button>
            </div>
          ) : null}

          {catalogsError ? (
            <div className="flex items-center gap-2 text-sm" role="alert">
              <span className="min-w-0 flex-1 text-destructive">
                {translate('project.materials.spreadsheet.catalogError')}
                {waitingForCatalogsCount > 0
                  ? ` ${translate('project.materials.spreadsheet.waitingFilesForCatalogs', { count: String(waitingForCatalogsCount) })}`
                  : ''}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRetryCatalogs}
              >
                {translate('common.actions.retry')}
              </Button>
            </div>
          ) : waitingForCatalogsCount > 0 ? (
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              role="status"
            >
              <LoaderCircle className="size-4 animate-spin" />
              {translate(
                'project.materials.spreadsheet.waitingFilesForCatalogs',
                { count: String(waitingForCatalogsCount) },
              )}
            </div>
          ) : null}

          <FileUploadContent
            ref={fileUploadRef}
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            maxFileSize={MAX_SPREADSHEET_FILE_BYTES}
            disabled={fileReading || outcomes !== null}
            isUploading={fileReading}
            showUploadButton={false}
            autoUpload
            dragActiveLabel={translate(
              'project.materials.spreadsheet.dropFilesImmediately',
            )}
            dragHint={translate(
              'project.materials.spreadsheet.dropFilesImmediatelyHint',
            )}
            onUpload={handleReadFiles}
            onUploadError={(error) =>
              setUploadError(getErrorText(error, translate))
            }
          >
            <div
              role="button"
              tabIndex={fileReading || outcomes !== null ? -1 : 0}
              aria-disabled={fileReading || outcomes !== null}
              className={`flex min-h-36 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 px-6 py-8 text-center transition-colors ${fileReading || outcomes !== null ? 'pointer-events-none opacity-60' : 'cursor-pointer hover:border-primary/60 hover:bg-primary/5'}`}
              onClick={() => fileUploadRef.current?.openFileDialog()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  fileUploadRef.current?.openFileDialog();
                }
              }}
            >
              <Upload className="mb-3 size-7 text-primary" />
              <span className="text-sm font-medium">
                {translate('project.materials.spreadsheet.dropFiles')}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                {translate('project.materials.spreadsheet.fileHelp')}
              </span>
            </div>
          </FileUploadContent>

          {sources.length > 0 ? (
            <div className="divide-y divide-border rounded-md border border-border">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                >
                  <FileIcon
                    fileType={source.file.type}
                    fileName={source.file.name}
                    alt=""
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                  <span
                    className="min-w-0 flex-1 truncate"
                    title={source.file.name}
                  >
                    {source.file.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {source.status === 'reading'
                      ? translate('project.materials.spreadsheet.readingFiles')
                      : translate(
                          'project.materials.spreadsheet.fileRowsCount',
                          {
                            count: String(source.rows.length),
                          },
                        )}
                  </span>
                  {source.status === 'reading' ? (
                    <LoaderCircle
                      className="size-4 shrink-0 animate-spin text-primary"
                      aria-label={translate(
                        'project.materials.spreadsheet.readingFiles',
                      )}
                    />
                  ) : source.status === 'error' ? (
                    <AlertCircle
                      className="size-4 shrink-0 text-destructive"
                      aria-label={source.globalErrors[0] ?? ''}
                    />
                  ) : (
                    <CheckCircle2
                      className="size-4 shrink-0 text-[var(--color-success-accent,var(--color-green-600))]"
                      aria-label={translate(
                        'project.materials.spreadsheet.fileReadSuccess',
                      )}
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    mode="icon"
                    size="sm"
                    disabled={fileReading || waitingForCatalogsCount > 0}
                    aria-label={`${translate('project.materials.spreadsheet.removeFile')} ${source.file.name}`}
                    onClick={() =>
                      setSources((current) =>
                        current.filter((item) => item.id !== source.id),
                      )
                    }
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {templateError || uploadError ? (
            <ErrorMessage>{templateError || uploadError}</ErrorMessage>
          ) : null}
        </StepperContent>

        <StepperContent
          value={2}
          className={
            step === 2 ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-4'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">
                {translate('project.materials.spreadsheet.previewCount', {
                  count: String(previewRows.length),
                })}
              </span>
              <span className="text-[var(--color-success-accent,var(--color-green-600))]">
                {translate('project.materials.spreadsheet.validCount', {
                  count: String(validRowCount),
                })}
              </span>
              <span className="text-destructive">
                {translate('project.materials.spreadsheet.errorCount', {
                  count: String(invalidRowCount),
                })}
              </span>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch
                checked={groupingEnabled}
                onCheckedChange={(checked) => {
                  setGroupingEnabled(checked);
                  if (!checked) {
                    setRowSelection((current) => {
                      const next: RowSelectionState = {};
                      for (const row of mappedRows) {
                        if (
                          row.values !== null &&
                          !row.error &&
                          current[row.id]
                        ) {
                          next[row.id] = true;
                        }
                      }
                      return next;
                    });
                  }
                  setPagination((current) => ({ ...current, pageIndex: 0 }));
                }}
                aria-label={translate(
                  'project.materials.spreadsheet.groupByModelToggle',
                )}
              />
              <span>
                {translate('project.materials.spreadsheet.groupByModelToggle')}
              </span>
            </label>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <DataGrid
              table={previewTable}
              recordCount={tableRows.length}
              emptyMessage={translate('project.materials.spreadsheet.noRows')}
              tableLayout={{
                dense: true,
                cellBorder: true,
                rowBorder: true,
                width: 'fixed',
              }}
              tableClassNames={{
                bodyRow: '[&>td]:py-1',
              }}
            >
              <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
                <DataGridTable />
              </div>
              {tableRows.length > 0 ? (
                <DataGridPagination
                  sizes={[10, 20, 50]}
                  className="mt-2 shrink-0 grow-0"
                  sizesDescription={translate(
                    groupingEnabled
                      ? 'project.materials.grouping.groups'
                      : 'project.materials.spreadsheet.row',
                  )}
                />
              ) : null}
            </DataGrid>
          </div>

          {modelProposals.length > 0 ? (
            <section className="shrink-0 space-y-3 rounded-md border border-admin-blue-border bg-admin-blue-light/30 p-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">
                  {translate(
                    'project.materials.spreadsheet.unknownModelsTitle',
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {translate(
                    'project.materials.spreadsheet.unknownModelsDescription',
                  )}
                </p>
              </div>
              <RadioGroup
                value={importMode}
                onValueChange={(value) => setImportMode(value as ImportMode)}
                className="gap-2"
              >
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <RadioGroupItem value="existing" className="mt-0.5" />
                  <span>
                    {translate(
                      'project.materials.spreadsheet.importOnlyExistingModels',
                    )}
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <RadioGroupItem
                    value="create"
                    className="mt-0.5"
                    disabled={
                      !canManageModels ||
                      (selectedModelProposals.length > 0 && !canCreateAllModels)
                    }
                  />
                  <span>
                    {translate(
                      'project.materials.spreadsheet.importAndCreateModels',
                      {
                        count: String(selectedModelProposals.length),
                      },
                    )}
                  </span>
                </label>
              </RadioGroup>
              {!canManageModels ? (
                <p className="text-xs text-muted-foreground">
                  {translate(
                    'project.materials.spreadsheet.createModelsPermission',
                  )}
                </p>
              ) : null}
              {proposalErrors.length > 0 ? (
                <ul className="list-disc space-y-1 ps-5 text-xs text-destructive">
                  {proposalErrors.map((proposal) => (
                    <li key={proposal.code}>
                      {proposal.code}: {proposal.error}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="max-h-28 overflow-auto rounded border border-border bg-background/80">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">
                        {translate(
                          'project.materials.spreadsheet.fields.modelCode',
                        )}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {translate(
                          'project.materials.spreadsheet.fields.modelName',
                        )}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {translate(
                          'project.materials.spreadsheet.fields.modelGroupCode',
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelProposals.map((proposal) => (
                      <tr
                        key={proposal.code}
                        className="border-t border-border"
                      >
                        <td className="px-3 py-2">{proposal.code}</td>
                        <td className="px-3 py-2">{proposal.name || '—'}</td>
                        <td className="px-3 py-2">
                          {proposal.groupCode || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </StepperContent>

        <StepperContent value={3} className="space-y-4">
          <ProgressBlock
            label={translate('project.materials.spreadsheet.importProgress', {
              processed: String(importProgress.processed),
              total: String(importProgress.total),
            })}
            count={importStage}
            value={importPercent}
            loading={importing}
            indicatorClassName={progressColor}
          />

          {outcomes ? (
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
              role="status"
            >
              {importFailureCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="size-4" />
                  {translate(
                    'project.materials.spreadsheet.failedMaterialsCount',
                    {
                      count: String(importFailureCount),
                    },
                  )}
                </span>
              ) : null}
            </div>
          ) : null}

          {outcomes?.some((outcome) => !outcome.success) ? (
            <div className="max-h-40 overflow-auto rounded-md border border-border">
              <table className="w-full min-w-[34rem] text-left text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      {translate('project.materials.spreadsheet.row')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {translate('project.materials.spreadsheet.fields.code')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {translate('project.materials.spreadsheet.result')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes
                    .filter((outcome) => !outcome.success)
                    .map((outcome) => (
                      <tr key={outcome.id} className="border-t border-border">
                        <td className="px-3 py-2">{outcome.rowNumber}</td>
                        <td className="px-3 py-2">{outcome.code || '—'}</td>
                        <td className="px-3 py-2 text-destructive">
                          {outcome.error}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {reportError ? <ErrorMessage>{reportError}</ErrorMessage> : null}
        </StepperContent>
      </Stepper>
    </div>
  );
}

function ProgressBlock({
  label,
  count,
  value,
  loading,
  complete = false,
  indicatorClassName,
}: {
  label: string;
  count: string;
  value: number;
  loading: boolean;
  complete?: boolean;
  indicatorClassName?: string;
}) {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-2 font-medium">
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {complete ? <CheckCircle2 className="size-4 text-success" /> : null}
          {label}
        </span>
        <span className="shrink-0 text-muted-foreground">
          {Math.round(value)}%
        </span>
      </div>
      <Progress
        value={value}
        indicatorClassName={
          indicatorClassName ?? (complete ? 'bg-success' : undefined)
        }
      />
      {count ? <p className="text-xs text-muted-foreground">{count}</p> : null}
    </div>
  );
}

function ErrorMessage({ children }: { children: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
      role="alert"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function summarizeGeneratedCodes(codes: string[]) {
  if (codes.length === 0) return '';
  if (codes.length === 1) return codes[0];
  return `${codes[0]} … ${codes[codes.length - 1]}`;
}

function normalizeModelCode(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getErrorText(
  error: unknown,
  translate: (id: string) => string,
): string {
  if (error instanceof SpreadsheetError) return translate(error.message);
  return error instanceof Error ? error.message : String(error);
}
