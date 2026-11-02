import type { MaterialGroup } from '@/project/material-groups/model/material-group';
import { MaterialSpecificationDataTypeIcon } from '@/project/material-specifications/components/material-specification-data-type-icon';
import { useIntl } from 'react-intl';
import { getApiErrorMessage } from '@/lib/errors';
import { CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { CardLoading } from '@/components/ui/loading';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MaterialModelSpecificationValues } from '../forms/material-model-specification-values';
import { TableSpecificationsStateRow } from './material-specifications-editor-table-view';
import { MaterialSpecificationsTableHeader } from './material-specifications-table-header';

export function MaterialGroupSpecificationsInheritedTable({
  groupId,
  group,
  isLoading,
  error,
  onRetry,
}: {
  groupId: string;
  group?: MaterialGroup;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const intl = useIntl();
  const specifications = group?.specifications ?? [];
  const title = group
    ? intl.formatMessage(
        { id: 'materialModels.specifications.groupTableTitle' },
        { groupName: group.name },
      )
    : intl.formatMessage({
        id: 'materialModels.specifications.groupTableTitleFallback',
      });

  return (
    <>
      <MaterialSpecificationsTableHeader
        mode="material"
        count={specifications.length}
        title={title}
      />
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
        {!groupId ? (
          <div className="flex min-h-40 items-center justify-center px-5 py-8 text-sm text-muted-foreground">
            {intl.formatMessage({
              id: 'materialModels.specifications.groupTableUnselected',
            })}
          </div>
        ) : isLoading ? (
          <CardLoading
            label={intl.formatMessage({ id: 'common.state.loading' })}
          />
        ) : error ? (
          <div className="p-5">
            <ErrorState
              title={intl.formatMessage({
                id: 'materialGroups.errors.loadTitle',
              })}
              description={getApiErrorMessage(error)}
              onRetry={onRetry}
            />
          </div>
        ) : (
          <ScrollArea
            type="always"
            className="min-h-0 min-w-0 flex-1"
            viewportClassName="h-full min-w-0 overflow-y-auto"
          >
            <div className="min-w-[768px]">
              <table className="w-full caption-bottom text-foreground text-sm">
                <TableHeader>
                  <TableRow hoverable={false}>
                    <TableHead className="sticky top-0 z-20 w-24 bg-muted text-center">
                      {intl.formatMessage({
                        id: 'project.materials.fields.specificationVisible',
                      })}
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 min-w-[260px] bg-muted">
                      {intl.formatMessage({
                        id: 'materialModels.specifications.column',
                      })}
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 min-w-[360px] bg-muted">
                      {intl.formatMessage({
                        id: 'materialModels.specifications.values',
                      })}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {specifications.length === 0 ? (
                    <TableSpecificationsStateRow colSpan={3} className="h-28">
                      <span className="text-muted-foreground">
                        {intl.formatMessage({
                          id: 'materialModels.specifications.groupTableEmpty',
                        })}
                      </span>
                    </TableSpecificationsStateRow>
                  ) : null}
                  {specifications.map((specification, index) => (
                    <TableRow key={specification.id} hoverable={false}>
                      <TableCell className="w-24 px-2 py-2 text-center align-top">
                        <Switch
                          checked={specification.isPublic}
                          disabled
                          aria-label={intl.formatMessage(
                            {
                              id: 'project.materials.fields.specificationPublicLabel',
                            },
                            { name: specification.name },
                          )}
                        />
                      </TableCell>
                      <TableCell className="px-2 py-2 align-top">
                        <div className="flex min-w-0 items-start gap-2">
                          <MaterialSpecificationDataTypeIcon
                            dataType={specification.dataType}
                            className="mt-1 size-4 shrink-0 text-muted-foreground"
                          />
                          <span className="min-w-0 truncate font-medium">
                            {specification.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2 align-top">
                        <MaterialModelSpecificationValues
                          mode="material"
                          canEdit={false}
                          dataType={specification.dataType}
                          isList={specification.isList}
                          values={specification.values}
                          valueLabels={specification.valueLabels}
                          suggestions={specification.values.map(
                            (value, valueIndex) => ({
                              id: `${specification.id}-${valueIndex}`,
                              label: value,
                              name: specification.valueLabels[valueIndex],
                            }),
                          )}
                          rowIndex={index}
                          fieldLabel={specification.name}
                          onChange={() => undefined}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>
    </>
  );
}
