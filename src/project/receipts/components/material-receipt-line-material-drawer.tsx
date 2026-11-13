import { useEffect, useState } from 'react';
import { MaterialModelSpecificationValues } from '@/project/material-models/forms/material-model-specification-values';
import type {
  MaterialModel,
  MaterialModelSpecification,
} from '@/project/material-models/model/material-model';
import { MaterialSpecificationDataTypeIcon } from '@/project/material-specifications/components/material-specification-data-type-icon';
import type { MaterialSpecificationOption } from '@/project/material-specifications/model/material-specification';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import type {
  MaterialReceiptItem,
  MaterialReceiptLine,
} from '../model/material-receipt';

interface MaterialReceiptLineMaterialDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line:
    | (Pick<
        MaterialReceiptLine,
        | 'model'
        | 'quantity'
        | 'specificationOverrides'
        | 'specificationOverrideLabels'
      > & {
        items?: MaterialReceiptItem[];
      })
    | null;
  model?: MaterialModel;
  readOnly?: boolean;
  requiresReason?: boolean;
  onSave: (
    values: Record<string, string[]>,
    labels: Record<string, string[]>,
    reason?: string,
  ) => void;
  isSaving?: boolean;
}

export function MaterialReceiptLineMaterialDrawer({
  open,
  onOpenChange,
  line,
  model,
  readOnly = false,
  requiresReason = false,
  onSave,
  isSaving = false,
}: MaterialReceiptLineMaterialDrawerProps) {
  const intl = useIntl();
  const [values, setValues] = useState<Record<string, string[]>>({});
  const [valueLabels, setValueLabels] = useState<Record<string, string[]>>({});
  const [reason, setReason] = useState('');
  const specifications =
    model?.specifications ?? line?.model.specifications ?? [];

  useEffect(() => {
    if (open) {
      const lineOverrides = line?.specificationOverrides ?? {};
      const firstUnitOverrides = line?.items?.find(
        (item) => item.status === 'active',
      );
      const currentMaterialOverrides =
        firstUnitOverrides?.currentSpecificationOverrides ??
        firstUnitOverrides?.material?.specificationOverrides;
      const currentMaterialOverrideLabels =
        firstUnitOverrides?.currentSpecificationOverrideLabels ??
        firstUnitOverrides?.material?.specificationOverrideLabels;
      setValues(
        Object.keys(lineOverrides).length > 0
          ? lineOverrides
          : currentMaterialOverrides &&
              typeof currentMaterialOverrides === 'object'
            ? (currentMaterialOverrides as Record<string, string[]>)
            : lineOverrides,
      );
      const lineLabels = line?.specificationOverrideLabels ?? {};
      setValueLabels(
        Object.keys(lineLabels).length > 0
          ? lineLabels
          : currentMaterialOverrideLabels &&
              typeof currentMaterialOverrideLabels === 'object'
            ? (currentMaterialOverrideLabels as Record<string, string[]>)
            : lineLabels,
      );
      setReason('');
    }
  }, [line, open]);

  const suggestionsFor = (specification: MaterialModelSpecification) =>
    specification.values
      .map(
        (label, index): MaterialSpecificationOption => ({
          id: `${specification.id}-${index}`,
          label,
          ...(specification.valueLabels[index]
            ? { name: specification.valueLabels[index] }
            : {}),
        }),
      )
      .filter((option) => option.label.trim().length > 0);

  const updateValues = (specificationId: string, nextValues: string[]) => {
    setValues((current) => {
      const next = { ...current };
      if (nextValues.length) next[specificationId] = nextValues;
      else delete next[specificationId];
      return next;
    });
    setValueLabels((current) => {
      const labels = current[specificationId];
      if (!labels) return current;
      const next = { ...current };
      const alignedLabels = nextValues.map((_, index) => labels[index] ?? '');
      if (alignedLabels.some((label) => label.trim()))
        next[specificationId] = alignedLabels;
      else delete next[specificationId];
      return next;
    });
  };

  const updateValueLabels = (specificationId: string, nextLabels: string[]) => {
    setValueLabels((current) => {
      const next = { ...current };
      if (nextLabels.some((label) => label.trim()))
        next[specificationId] = nextLabels;
      else delete next[specificationId];
      return next;
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="inset-y-0 right-0 bottom-auto left-auto mt-0 h-full w-[min(100vw,48rem)] rounded-none border-l [&>div:first-child]:hidden">
        <DrawerHeader className="border-b border-border px-6 py-5 text-left">
          <DrawerTitle>
            {intl.formatMessage({ id: 'receipts.materialDrawer.title' })}
          </DrawerTitle>
          <DrawerDescription>
            {intl.formatMessage(
              { id: 'receipts.materialDrawer.description' },
              {
                model: line?.model.name ?? model?.name ?? '',
                quantity: line?.quantity ?? 0,
              },
            )}
          </DrawerDescription>
        </DrawerHeader>
        <ScrollArea className="min-h-0 flex-1 px-6 py-5">
          {requiresReason ? (
            <label className="mb-5 block space-y-2">
              <span className="text-sm font-medium">
                {intl.formatMessage({ id: 'receipts.fields.reason' })}
                <span className="ml-1 text-destructive">*</span>
              </span>
              <Textarea
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          ) : null}
          {specifications.length ? (
            <div className="divide-y divide-border">
              {specifications.map((specification, index) => (
                <section
                  key={specification.id}
                  className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(0,1.2fr)] sm:items-start"
                >
                  <div className="flex min-w-0 items-center gap-2 pt-1">
                    <MaterialSpecificationDataTypeIcon
                      dataType={specification.dataType}
                    />
                    <span className="text-sm font-medium">
                      {specification.name}
                    </span>
                  </div>
                  <MaterialModelSpecificationValues
                    mode="material"
                    canEdit={!readOnly}
                    dataType={specification.dataType}
                    isList={specification.isList}
                    values={
                      values[specification.id] ??
                      (specification.values.length === 1
                        ? [specification.values[0]]
                        : [])
                    }
                    valueLabels={
                      valueLabels[specification.id] ??
                      (
                        values[specification.id] ??
                        (specification.values.length === 1
                          ? [specification.values[0]]
                          : [])
                      ).map((value) => {
                        const valueIndex = specification.values.indexOf(value);
                        return valueIndex >= 0
                          ? (specification.valueLabels[valueIndex] ?? '')
                          : '';
                      })
                    }
                    suggestions={suggestionsFor(specification)}
                    rowIndex={index}
                    fieldLabel={specification.name}
                    onChange={(nextValues) =>
                      updateValues(specification.id, nextValues)
                    }
                    onValueLabelsChange={(nextLabels) =>
                      updateValueLabels(specification.id, nextLabels)
                    }
                  />
                </section>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {intl.formatMessage({ id: 'receipts.materialDrawer.empty' })}
            </p>
          )}
        </ScrollArea>
        <DrawerFooter className="flex-row justify-end border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {intl.formatMessage({ id: 'common.actions.cancel' })}
          </Button>
          {!readOnly ? (
            <Button
              type="button"
              variant="primary"
              loading={isSaving}
              loadingText={intl.formatMessage({ id: 'common.state.saving' })}
              disabled={requiresReason && !reason.trim()}
              onClick={() => onSave(values, valueLabels, reason.trim())}
            >
              {intl.formatMessage({ id: 'common.actions.save' })}
            </Button>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
