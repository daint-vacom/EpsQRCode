import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchInput } from '@/components/ui/inputs/search-input';
import { EpsUnitSelectionDialogShell } from './eps-unit-selection-dialog-shell.generated';

export interface EpsUnitSelectionItem {
  id: string;
  code: string;
  name: string;
  parentName?: string | null;
}

interface EpsUnitSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: readonly EpsUnitSelectionItem[];
  selectedIds: readonly string[];
  onConfirm: (selectedIds: string[]) => void;
}

export function EpsUnitSelectionDialog({
  open,
  onOpenChange,
  units,
  selectedIds,
  onConfirm,
}: EpsUnitSelectionDialogProps) {
  const intl = useIntl();
  const [search, setSearch] = useState('');
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds.slice());
  const filteredUnits = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    if (!keyword) return units;
    return units.filter((unit) =>
      `${unit.code} ${unit.name} ${unit.parentName ?? ''}`
        .toLocaleLowerCase()
        .includes(keyword),
    );
  }, [search, units]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setDraftIds(selectedIds.slice());
  }, [open, selectedIds]);

  const toggleUnit = (id: string, checked: boolean) => {
    setDraftIds((current) =>
      checked
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((selectedId) => selectedId !== id),
    );
  };

  const handleConfirm = () => {
    onConfirm(draftIds);
    onOpenChange(false);
  };

  return (
    <EpsUnitSelectionDialogShell
      open={open}
      onOpenChange={onOpenChange}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => onOpenChange(false)}
          >
            {intl.formatMessage({ id: 'common.actions.cancel' })}
          </Button>
          <Button type="button" size="md" onClick={handleConfirm}>
            <Check />
            {intl.formatMessage(
              { id: 'custodians.epsUnitSelection.confirmCount' },
              { count: draftIds.length },
            )}
          </Button>
        </>
      }
    >
      <div className="flex min-h-0 flex-col gap-3">
        <SearchInput
          aria-label={intl.formatMessage({
            id: 'custodians.epsUnitSelection.search',
          })}
          placeholder={intl.formatMessage({
            id: 'custodians.epsUnitSelection.search',
          })}
          value={search}
          onSearch={setSearch}
        />
        <div className="max-h-[min(52dvh,28rem)] overflow-y-auto rounded-md border border-border">
          {filteredUnits.length ? (
            <div className="divide-y divide-border">
              {filteredUnits.map((unit) => {
                const checked = draftIds.includes(unit.id);
                return (
                  <label
                    key={unit.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleUnit(unit.id, value === true)
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {unit.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {unit.code}
                        {unit.parentName ? ` · ${unit.parentName}` : ''}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {intl.formatMessage({ id: 'custodians.epsUnitSelection.empty' })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {intl.formatMessage(
              { id: 'custodians.epsUnitSelection.selectedCount' },
              { count: draftIds.length },
            )}
          </span>
          {draftIds.length ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDraftIds([])}
            >
              {intl.formatMessage({ id: 'custodians.epsUnitSelection.clear' })}
            </Button>
          ) : null}
        </div>
      </div>
    </EpsUnitSelectionDialogShell>
  );
}
