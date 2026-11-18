/**
 * Scaffolded by table-builder from `src/project/materials/table/material.table.fixture.ts`. Run `npm run gen:table` — do NOT hand-write this file.
 * You own this file now — fill the `cell: () => null` stubs and wire it up. To change columns or
 * badge config, edit the spec and re-gen to a scratch path, then reconcile your edits. Do not
 * hand-edit this banner or the generated badge config — that's how review detects a bypassed builder.
 */
import { useMemo, useRef } from 'react';
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';
import {
  ChevronDown,
  Eye,
  Folder,
  Handshake,
  Pencil,
  QrCode,
  Trash2,
} from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import {
  createColumnHelpers,
  DataGridActionButton,
  getDataGridActionsColumnSize,
} from '@/components/ui/data-grid-columns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MaterialIdentity } from '@/components/material-identity';
import { MaterialAvailabilityCell } from '../components/material-availability-cell';
import { MaterialQrCodeButton } from '../components/material-qr-code-button';
import { MaterialConditionBadge } from '../components/material-value-badges';
import type { Material } from '../model/material';

export interface UseMaterialColumnsParams {
  partyNameById: ReadonlyMap<string, string>;
  groupNameById: ReadonlyMap<string, string>;
  canManage: boolean;
  pendingAvailabilityIds: ReadonlySet<string>;
  onAvailabilityChange: (material: Material, isActive: boolean) => void;
  onOpenQr: (material: Material) => void;
  onView: (material: Material) => void;
  onEdit: (material: Material) => void;
  onHandover: (material: Material) => void;
  onDelete: (material: Material) => void;
  onPrint: (material: Material) => void;
}

interface MaterialActionMenuProps {
  material: Material;
  canManage: boolean;
  canPrint: boolean;
  onEdit: (material: Material) => void;
  onHandover: (material: Material) => void;
  onDelete: (material: Material) => void;
  onPrint: (material: Material) => void;
}

function MaterialActionMenu({
  material,
  canManage,
  canPrint,
  onEdit,
  onHandover,
  onDelete,
  onPrint,
}: MaterialActionMenuProps) {
  const intl = useIntl();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openedByPointer = useRef(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          mode="icon"
          size="sm"
          aria-label={intl.formatMessage({
            id: 'project.materials.actions.more',
          })}
          onPointerDown={() => {
            openedByPointer.current = true;
          }}
          onKeyDown={() => {
            openedByPointer.current = false;
          }}
        >
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onKeyDownCapture={() => {
          openedByPointer.current = false;
        }}
        onCloseAutoFocus={(event) => {
          if (!openedByPointer.current) return;
          event.preventDefault();
          triggerRef.current?.blur();
          openedByPointer.current = false;
        }}
      >
        {canPrint ? (
          <DropdownMenuItem onSelect={() => onPrint(material)}>
            <QrCode />
            {intl.formatMessage({ id: 'project.materials.actions.printQr' })}
          </DropdownMenuItem>
        ) : null}
        {canManage ? (
          <>
            <DropdownMenuItem
              disabled={Boolean(material.reservedHandoverId)}
              onSelect={() => onEdit(material)}
            >
              <Pencil />
              {intl.formatMessage({
                id: 'project.materials.actions.editMaterial',
              })}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={Boolean(material.reservedHandoverId)}
              onSelect={() => onHandover(material)}
            >
              <Handshake />
              {intl.formatMessage({ id: 'project.materials.actions.handover' })}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onDelete(material)}
            >
              <Trash2 />
              {intl.formatMessage({ id: 'project.materials.actions.delete' })}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const MATERIAL_COLUMN_PINNING: ColumnPinningState = {
  left: ['select'],
  right: ['actions'],
};

export function useMaterialColumns({
  partyNameById,
  groupNameById,
  canManage,
  pendingAvailabilityIds,
  onAvailabilityChange,
  onOpenQr,
  onView,
  onEdit,
  onHandover,
  onDelete,
  onPrint,
}: UseMaterialColumnsParams): ColumnDef<Material>[] {
  const intl = useIntl();

  return useMemo(() => {
    const col = createColumnHelpers<Material>();

    return [
      col.select(),
      col.custom({
        id: 'availability',
        header: intl.formatMessage({
          id: 'materialModels.fields.availability',
        }),
        size: 80,
        enableSorting: false,
        cell: (row) => (
          <MaterialAvailabilityCell
            material={row}
            canManage={canManage}
            isPending={pendingAvailabilityIds.has(row.id)}
            onChange={onAvailabilityChange}
          />
        ),
      }),
      col.custom({
        id: 'qrCode',
        header: intl.formatMessage({ id: 'project.materials.fields.qrCode' }),
        size: 80,
        enableSorting: false,
        cell: (row) => (
          <MaterialQrCodeButton material={row} onOpen={onOpenQr} />
        ),
      }),
      col.custom({
        id: 'identity',
        header: intl.formatMessage({ id: 'project.materials.fields.identity' }),
        headerClassName: 'min-w-[260px]',
        size: 320,
        enableSorting: false,
        cell: (row) => (
          <MaterialIdentity
            name={row.nameOverride?.trim() || row.modelSnapshot.name}
            code={row.code}
            imageUrl={row.images.find((image) => image.isCover)?.url}
          />
        ),
      }),
      col.custom({
        id: 'group',
        header: intl.formatMessage({ id: 'materialGroups.columns.groupShort' }),
        size: 220,
        enableSorting: false,
        cell: (row) => {
          const groupName = row.modelSnapshot.groupId
            ? groupNameById.get(row.modelSnapshot.groupId)
            : null;
          if (!groupName) return null;

          return (
            <span className="flex min-w-0 items-center gap-2">
              <Folder className="size-4 shrink-0 text-muted-foreground" />
              <span className="whitespace-normal break-words" title={groupName}>
                {groupName}
              </span>
            </span>
          );
        },
      }),
      col.custom({
        id: 'custody',
        header: intl.formatMessage({ id: 'project.materials.fields.holder' }),
        size: 200,
        enableSorting: false,
        cell: (row) =>
          row.status === 'loaned'
            ? row.borrowerSnapshot?.name ||
              (row.borrowerPartyId
                ? (partyNameById.get(row.borrowerPartyId) ??
                  row.borrowerPartyId)
                : '—')
            : row.ownerSnapshot.name,
      }),
      col.custom({
        id: 'condition',
        header: intl.formatMessage({
          id: 'project.materials.fields.condition',
        }),
        size: 120,
        enableSorting: false,
        cell: (row) => <MaterialConditionBadge value={row.condition} />,
      }),
      col.actions({
        cellClassName: 'text-right',
        header: '',
        size:
          canManage || Boolean(onPrint) ? 112 : getDataGridActionsColumnSize(1),
        enableSorting: false,
        cell: (row) => (
          <div className="flex items-center justify-end gap-2">
            <DataGridActionButton
              action="primary"
              type="button"
              mode="link"
              size="sm"
              onClick={() => onView(row)}
            >
              <Eye className="size-3.5" />
              {intl.formatMessage({
                id: 'project.materials.actions.viewShort',
              })}
            </DataGridActionButton>
            {canManage || Boolean(onPrint) ? (
              <MaterialActionMenu
                material={row}
                canManage={canManage}
                canPrint={Boolean(onPrint)}
                onEdit={onEdit}
                onHandover={onHandover}
                onDelete={onDelete}
                onPrint={onPrint}
              />
            ) : null}
          </div>
        ),
      }),
    ];
  }, [
    canManage,
    intl,
    onAvailabilityChange,
    onOpenQr,
    onEdit,
    onHandover,
    onDelete,
    onView,
    onPrint,
    partyNameById,
    groupNameById,
    pendingAvailabilityIds,
  ]);
}
