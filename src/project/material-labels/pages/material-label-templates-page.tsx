import { useMemo, useState } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { MATERIAL_PERMISSION_CODES } from '@/project/materials/model/material-permissions';
import { FilterCountChips } from '@/project/shared/filter-count-chips';
import { ProjectFilterModeSwitcher } from '@/project/shared/project-filter-mode.generated';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Plus, QrCode } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useUser } from '@/providers/user-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridHeader } from '@/components/ui/data-grid-header';
import { DataGridHeaderMenu } from '@/components/ui/data-grid-header-menu';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/inputs/search-input';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  useMaterialLabelTemplateFilterSummaryQuery,
  useMaterialLabelTemplatesQuery,
  useSaveMaterialLabelTemplateMutation,
} from '../hooks/use-material-label-templates';
import type { MaterialLabelTemplate } from '../model/material-label-template';
import {
  MATERIAL_LABEL_TEMPLATE_COLUMN_PINNING,
  useMaterialLabelTemplateColumns,
} from '../table/material-label-template.columns.generated';

const EMPTY_TEMPLATES: MaterialLabelTemplate[] = [];

export function MaterialLabelTemplatesPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { hasPermission } = useUser();
  const { isPermissionsPending } = useWorkspace();
  const canView = hasPermission(MATERIAL_PERMISSION_CODES.view);
  const canManage = hasPermission(MATERIAL_PERMISSION_CODES.manage);
  const query = useMaterialLabelTemplatesQuery(
    !isPermissionsPending && canView,
  );
  const saveMutation = useSaveMaterialLabelTemplateMutation();
  const [keyword, setKeyword] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [defaultFilter, setDefaultFilter] = useState('');
  const [filterMode, setFilterMode] = useState<'status' | 'default'>('status');
  const [deactivatingTemplate, setDeactivatingTemplate] =
    useState<MaterialLabelTemplate | null>(null);

  const templates = query.data ?? EMPTY_TEMPLATES;
  const summaryQuery = useMaterialLabelTemplateFilterSummaryQuery(
    keyword.trim(),
    !isPermissionsPending && canView,
  );
  const summary = summaryQuery.data;
  const filteredTemplates = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase('vi');
    return templates.filter(
      (template) =>
        (!activeFilter || template.isActive === (activeFilter === 'active')) &&
        (!defaultFilter ||
          template.isDefault === (defaultFilter === 'default')) &&
        (!normalized ||
          [template.name, template.description ?? '']
            .join(' ')
            .toLocaleLowerCase('vi')
            .includes(normalized)),
    );
  }, [keyword, templates, activeFilter, defaultFilter]);

  const columns = useMaterialLabelTemplateColumns({
    onEdit: (template) => {
      if (!canManage) return;
      navigate(
        buildPath(ROUTES.PROJECT.MATERIAL_LABEL_TEMPLATE_EDIT, {
          id: template.id,
        }),
      );
    },
    onDelete: (template) => {
      if (canManage && template.isActive) setDeactivatingTemplate(template);
    },
  });
  const table = useReactTable({
    data: filteredTemplates,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      columnPinning: MATERIAL_LABEL_TEMPLATE_COLUMN_PINNING,
      columnVisibility: { actions: canManage },
    },
  });

  const deactivateTemplate = async () => {
    if (!canManage || !deactivatingTemplate) return;
    try {
      await saveMutation.mutateAsync({
        id: deactivatingTemplate.id,
        name: deactivatingTemplate.name,
        description: deactivatingTemplate.description ?? '',
        widthMm: deactivatingTemplate.widthMm,
        heightMm: deactivatingTemplate.heightMm,
        design: deactivatingTemplate.design,
        isDefault: deactivatingTemplate.isDefault,
        isActive: false,
      });
      toast.success(
        intl.formatMessage({ id: 'project.materialLabels.states.inactive' }),
      );
      setDeactivatingTemplate(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-admin-page-section p-4 lg:p-5">
      <PageHeader
        title={intl.formatMessage({ id: 'project.materialLabels.page.title' })}
        icon={QrCode}
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() =>
                navigate(ROUTES.PROJECT.MATERIAL_LABEL_TEMPLATE_CREATE)
              }
            >
              <Plus />
              {intl.formatMessage({
                id: 'project.materialLabels.actions.create',
              })}
            </Button>
          ) : null
        }
      />

      <DataGrid
        table={table}
        recordCount={filteredTemplates.length}
        isLoading={isPermissionsPending || (canView && query.isPending)}
        isFetching={query.isFetching}
        emptyMessage={intl.formatMessage({
          id:
            keyword || activeFilter || defaultFilter
              ? 'project.materialLabels.empty.search'
              : 'project.materialLabels.empty.description',
        })}
      >
        <Card className="min-h-[28rem] min-w-0 flex-1 overflow-hidden">
          <DataGridHeader
            variant="stats"
            recordCountLabel={intl.formatMessage({
              id: 'project.materialLabels.page.title',
            })}
            stats={
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <SearchInput
                    className="w-72 shrink-0"
                    value={keyword}
                    onSearch={(value) => {
                      setKeyword(value);
                      table.setPageIndex(0);
                    }}
                    placeholder={intl.formatMessage({
                      id: 'common.actions.search',
                    })}
                  />
                  <ProjectFilterModeSwitcher
                    value={filterMode}
                    onValueChange={(value) => {
                      setFilterMode(value as 'status' | 'default');
                      setActiveFilter('');
                      setDefaultFilter('');
                      table.setPageIndex(0);
                    }}
                    options={[
                      {
                        value: 'status',
                        label: intl.formatMessage({
                          id: 'project.management.filters.status',
                        }),
                      },
                      {
                        value: 'default',
                        label: intl.formatMessage({
                          id: 'project.management.filters.defaultTemplate',
                        }),
                      },
                    ]}
                    disabled={!canView || isPermissionsPending}
                  />
                </div>
                <FilterCountChips
                  ariaLabel={intl.formatMessage({
                    id:
                      filterMode === 'default'
                        ? 'project.management.filters.defaultTemplate'
                        : 'project.management.filters.status',
                  })}
                  value={filterMode === 'status' ? activeFilter : defaultFilter}
                  onValueChange={(value) => {
                    if (filterMode === 'status') setActiveFilter(value);
                    else setDefaultFilter(value);
                    table.setPageIndex(0);
                  }}
                  disabled={!canView || isPermissionsPending}
                  options={
                    filterMode === 'status'
                      ? [
                          {
                            value: '',
                            label: intl.formatMessage({
                              id: 'project.management.filters.all',
                            }),
                            count: summary?.total,
                          },
                          {
                            value: 'active',
                            label: intl.formatMessage({
                              id: 'project.management.filters.active',
                            }),
                            count: summary?.active,
                          },
                          {
                            value: 'inactive',
                            label: intl.formatMessage({
                              id: 'project.management.filters.inactive',
                            }),
                            count: summary?.inactive,
                          },
                        ]
                      : [
                          {
                            value: '',
                            label: intl.formatMessage({
                              id: 'project.management.filters.all',
                            }),
                            count: summary?.total,
                          },
                          {
                            value: 'default',
                            label: intl.formatMessage({
                              id: 'project.management.filters.default',
                            }),
                            count: summary?.default,
                          },
                          {
                            value: 'not_default',
                            label: intl.formatMessage({
                              id: 'project.management.filters.notDefault',
                            }),
                            count: summary?.notDefault,
                          },
                        ]
                  }
                />
              </div>
            }
            toolbar={<DataGridHeaderMenu table={table} />}
          />

          <CardTable className="min-h-0 flex-1">
            {!isPermissionsPending && !canView ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.materialLabels.errors.permission',
                })}
                description={intl.formatMessage({
                  id: 'project.materialLabels.errors.permission',
                })}
              />
            ) : query.isError ? (
              <ErrorState
                title={intl.formatMessage({
                  id: 'project.materialLabels.errors.loadTitle',
                })}
                description={getApiErrorMessage(query.error)}
                onRetry={() => void query.refetch()}
              />
            ) : templates.length === 0 && !query.isPending ? (
              <div className="flex h-full min-h-56 flex-col items-center justify-center gap-2 px-6 text-center">
                <QrCode
                  className="size-8 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-semibold">
                  {intl.formatMessage({
                    id: 'project.materialLabels.empty.title',
                  })}
                </h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  {intl.formatMessage({
                    id: 'project.materialLabels.empty.description',
                  })}
                </p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex h-full min-h-56 items-center justify-center text-sm text-muted-foreground">
                {intl.formatMessage({ id: 'common.state.empty' })}
              </div>
            ) : (
              <ScrollArea className="h-full">
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardTable>

          <CardFooter className="justify-between">
            {canView && !isPermissionsPending && !query.isError ? (
              <DataGridPagination />
            ) : null}
          </CardFooter>
        </Card>
      </DataGrid>

      <ConfirmDialog
        open={deactivatingTemplate !== null}
        onOpenChange={(open) => !open && setDeactivatingTemplate(null)}
        title={intl.formatMessage({
          id: 'project.materialLabels.confirm.deactivateTitle',
        })}
        description={intl.formatMessage({
          id: 'project.materialLabels.confirm.deactivateDescription',
        })}
        confirmLabel={intl.formatMessage({
          id: 'project.materialLabels.actions.deactivate',
        })}
        confirmVariant="destructive"
        isConfirming={saveMutation.isPending}
        closeOnConfirm={false}
        onConfirm={() => void deactivateTemplate()}
      />
    </div>
  );
}
