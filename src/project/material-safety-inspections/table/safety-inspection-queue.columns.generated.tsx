/**
 * Scaffolded by table-builder from `src/project/material-safety-inspections/table/safety-inspection-queue.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo } from 'react';
import { buildPath, ROUTES } from '@/constants/routes';
import { MaterialQrCode } from '@/project/materials/components/material-qr-code';
import type { ColumnDef } from '@tanstack/react-table';
import { ClipboardCheck, ClipboardPenLine } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import {
  createColumnHelpers,
  DataGridActionButton,
} from '@/components/ui/data-grid-columns';
import { MaterialIdentity } from '@/components/material-identity';
import type { MaterialSafetyInspectionQueueRow } from '../model/safety-inspection';

export interface UseMaterialSafetyInspectionQueueColumnsParams {
  canManage: boolean;
}

export function useMaterialSafetyInspectionQueueColumns(
  params: UseMaterialSafetyInspectionQueueColumnsParams,
): ColumnDef<MaterialSafetyInspectionQueueRow>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<MaterialSafetyInspectionQueueRow>();

    return [
      col.custom({
        id: 'qrCode',
        header: intl.formatMessage({ id: 'project.materials.fields.qrCode' }),
        size: 90,
        enableSorting: false,
        cell: (row) => (
          <MaterialQrCode
            materialId={row.id}
            materialCode={row.code}
            size={40}
            className="mx-auto block"
          />
        ),
      }),
      col.custom({
        id: 'identity',
        header: intl.formatMessage({ id: 'project.materials.fields.identity' }),
        headerClassName: 'min-w-[260px]',
        size: 320,
        enableSorting: false,
        cell: (row) => <MaterialIdentity name={row.name} code={row.code} />,
      }),
      col.custom({
        id: 'lastInspection',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.lastInspection',
        }),
        size: 170,
        enableSorting: false,
        cell: (row) =>
          row.lastInspectedAt ? (
            <span className="text-sm text-foreground">
              {formatDate(row.lastInspectedAt)}
            </span>
          ) : null,
      }),
      col.custom({
        id: 'nextDue',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.nextDue',
        }),
        size: 190,
        enableSorting: false,
        cell: (row) => (
          <div className="space-y-1">
            <p className="text-sm text-foreground">
              {formatDate(new Date(`${row.nextDueDate}T00:00:00`))}
            </p>
            <p
              className={
                row.daysRemaining < 0
                  ? 'text-xs font-medium text-destructive'
                  : 'text-xs text-muted-foreground'
              }
            >
              {row.daysRemaining < 0
                ? intl.formatMessage(
                    {
                      id: 'project.materials.safetyInspection.queue.daysOverdue',
                    },
                    { days: Math.abs(row.daysRemaining) },
                  )
                : row.daysRemaining === 0
                  ? intl.formatMessage({
                      id: 'project.materials.safetyInspection.queue.dueToday',
                    })
                  : intl.formatMessage(
                      {
                        id: 'project.materials.safetyInspection.queue.daysRemaining',
                      },
                      { days: row.daysRemaining },
                    )}
            </p>
          </div>
        ),
      }),
      col.custom({
        id: 'status',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.status',
        }),
        size: 165,
        enableSorting: false,
        cell: (row) => (
          <Badge
            variant={
              row.status === 'due'
                ? 'destructive'
                : row.status === 'in_progress'
                  ? 'warning'
                  : 'success'
            }
          >
            {intl.formatMessage({
              id: `project.materials.safetyInspection.queue.status.${row.status === 'in_progress' ? 'inProgress' : row.status}`,
            })}
          </Badge>
        ),
      }),
      col.custom({
        id: 'startInspection',
        header: intl.formatMessage({
          id: 'project.materials.safetyInspection.queue.action',
        }),
        cellClassName: 'text-right',
        size: 210,
        enableSorting: false,
        cell: (row) => {
          const inProgress =
            row.status === 'in_progress' && row.activeInspectionId !== null;
          const label = intl.formatMessage({
            id: inProgress
              ? 'project.materials.safetyInspection.actions.continue'
              : 'project.materials.safetyInspection.actions.createNow',
          });
          if (!row.hasChecklist || !params.canManage) {
            return (
              <DataGridActionButton
                action="primary"
                type="button"
                mode="link"
                size="sm"
                disabled
                title={intl.formatMessage({
                  id: row.hasChecklist
                    ? 'project.materials.safetyInspection.queue.noManage'
                    : 'project.materials.safetyInspection.queue.noChecklist',
                })}
              >
                <ClipboardPenLine />
                {label}
              </DataGridActionButton>
            );
          }
          const path = inProgress
            ? buildPath(ROUTES.PROJECT.MATERIAL_SAFETY_INSPECTION_DETAIL, {
                id: row.id,
                inspectionId: row.activeInspectionId!,
              })
            : buildPath(ROUTES.PROJECT.MATERIAL_SAFETY_INSPECTION_CREATE, {
                id: row.id,
              });
          return (
            <DataGridActionButton
              action="primary"
              asChild
              mode="link"
              size="sm"
            >
              <Link
                to={path}
                state={{
                  returnTo: ROUTES.PROJECT.MATERIALS_REQUIRING_INSPECTION,
                }}
              >
                {inProgress ? <ClipboardCheck /> : <ClipboardPenLine />}
                {label}
              </Link>
            </DataGridActionButton>
          );
        },
      }),
    ];
  }, [intl, params.canManage]);
}
