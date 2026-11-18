import { useEffect, useId, useState } from 'react';
import { Settings } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DEFAULT_MATERIAL_GROUPING_CONFIG,
  type MaterialGroupingConfig,
} from '../model/material';
import { MaterialGroupingDialogShell } from './material-grouping-dialog-shell.generated';
import { MaterialConditionBadge } from './material-value-badges';

export interface MaterialGroupingControlsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  config: MaterialGroupingConfig;
  onApply: (config: MaterialGroupingConfig) => void;
  disabled?: boolean;
}

export function MaterialGroupingControls({
  enabled,
  onEnabledChange,
  config,
  onApply,
  disabled = false,
}: MaterialGroupingControlsProps) {
  const intl = useIntl();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  useEffect(() => {
    if (open) setDraft(config);
  }, [config, open]);

  const exampleRows = draft.condition
    ? draft.owner
      ? [
          { owner: 'hcm', condition: 'good', quantity: 2 },
          { owner: 'hcm', condition: 'damaged', quantity: 1 },
          { owner: 'hanoi', condition: 'good', quantity: 1 },
          { owner: 'hanoi', condition: 'damaged', quantity: 1 },
        ]
      : [
          { owner: 'all', condition: 'good', quantity: 3 },
          { owner: 'all', condition: 'damaged', quantity: 2 },
        ]
    : draft.owner
      ? [
          { owner: 'hcm', condition: null, quantity: 3 },
          { owner: 'hanoi', condition: null, quantity: 2 },
        ]
      : [{ owner: 'all', condition: null, quantity: 5 }];

  const label = intl.formatMessage({ id: 'project.materials.grouping.toggle' });
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled}
          aria-label={label}
        />
        <span>{label}</span>
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={intl.formatMessage({
          id: 'project.materials.grouping.settings',
        })}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Settings aria-hidden="true" />
      </Button>
      <MaterialGroupingDialogShell
        open={open}
        onOpenChange={setOpen}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft(DEFAULT_MATERIAL_GROUPING_CONFIG)}
            >
              {intl.formatMessage({ id: 'project.materials.grouping.restore' })}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {intl.formatMessage({ id: 'project.materials.grouping.cancel' })}
            </Button>
            <Button
              type="button"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              {intl.formatMessage({ id: 'project.materials.grouping.apply' })}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <fieldset className="space-y-3">
            <legend className="text-sm">
              {intl.formatMessage({
                id: 'project.materials.grouping.quantityQuestion',
              })}
            </legend>
            <RadioGroup
              value={draft.owner ? 'byOwner' : 'total'}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  owner: value === 'byOwner',
                }))
              }
              aria-label={intl.formatMessage({
                id: 'project.materials.grouping.quantityQuestion',
              })}
            >
              {(['byOwner', 'total'] as const).map((mode) => (
                <div key={mode} className="flex items-start gap-2">
                  <RadioGroupItem
                    id={fieldId + '-' + mode}
                    value={mode}
                    aria-describedby={fieldId + '-' + mode + '-description'}
                  />
                  <div className="space-y-1">
                    <Label htmlFor={fieldId + '-' + mode}>
                      {intl.formatMessage({
                        id: 'project.materials.grouping.' + mode,
                      })}
                    </Label>
                    <p
                      id={fieldId + '-' + mode + '-description'}
                      className="text-sm text-muted-foreground"
                    >
                      {intl.formatMessage({
                        id:
                          'project.materials.grouping.' + mode + 'Description',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </fieldset>
          <div className="flex items-start gap-2">
            <Checkbox
              id={fieldId + '-condition'}
              checked={draft.condition}
              aria-describedby={fieldId + '-condition-description'}
              onCheckedChange={(checked) =>
                setDraft((value) => ({ ...value, condition: checked === true }))
              }
            />
            <div className="space-y-1">
              <Label htmlFor={fieldId + '-condition'}>
                {intl.formatMessage({
                  id: 'project.materials.grouping.separateCondition',
                })}
              </Label>
              <p
                id={fieldId + '-condition-description'}
                className="text-sm text-muted-foreground"
              >
                {intl.formatMessage({
                  id: 'project.materials.grouping.separateConditionDescription',
                })}
              </p>
            </div>
          </div>
          <section
            className="space-y-2"
            aria-labelledby={fieldId + '-example'}
            aria-live="polite"
          >
            <p id={fieldId + '-example'} className="text-sm">
              {intl.formatMessage({
                id: 'project.materials.grouping.exampleTitle',
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {intl.formatMessage({
                id: 'project.materials.grouping.exampleDescription',
              })}
            </p>
            <div className="overflow-x-auto rounded-md border border-border">
              <Table
                aria-label={intl.formatMessage({
                  id: 'project.materials.grouping.exampleTitle',
                })}
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {intl.formatMessage({
                        id: 'project.materials.grouping.model',
                      })}
                    </TableHead>
                    {draft.owner && (
                      <TableHead>
                        {intl.formatMessage({
                          id: 'project.materials.grouping.owner',
                        })}
                      </TableHead>
                    )}
                    {draft.condition && (
                      <TableHead>
                        {intl.formatMessage({
                          id: 'project.materials.grouping.condition',
                        })}
                      </TableHead>
                    )}
                    <TableHead>
                      {intl.formatMessage({
                        id: 'project.materials.grouping.quantity',
                      })}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exampleRows.map((row) => (
                    <TableRow key={row.owner + '-' + row.condition}>
                      <TableCell>
                        {intl.formatMessage({
                          id: 'project.materials.grouping.exampleModel',
                        })}
                      </TableCell>
                      {draft.owner && (
                        <TableCell>
                          {intl.formatMessage({
                            id:
                              'project.materials.grouping.exampleOwner.' +
                              row.owner,
                          })}
                        </TableCell>
                      )}
                      {draft.condition && (
                        <TableCell>
                          <MaterialConditionBadge value={row.condition} />
                        </TableCell>
                      )}
                      <TableCell>{row.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </MaterialGroupingDialogShell>
    </div>
  );
}
