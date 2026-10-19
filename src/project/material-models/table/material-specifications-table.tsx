import { useState } from 'react';
import { MaterialSpecificationDataTypeIcon } from '@/project/material-specifications/components/material-specification-data-type-icon';
import type { UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { MaterialModelSpecificationValues } from '../forms/material-model-specification-values';
import type {
  MaterialModelFormValues,
  MaterialModelSpecification,
} from '../model/material-model';
import { MaterialModelSpecificationsEditorTable } from './material-model-specifications-editor-table.generated';
import {
  MaterialSpecificationsEditorTableRow,
  MaterialSpecificationsEditorTableView,
} from './material-specifications-editor-table-view';

type MaterialModeProps = {
  mode: 'material';
  specifications: MaterialModelSpecification[] | null;
  values: Record<string, string[]>;
  valueLabels: Record<string, string[]>;
  onChange: (values: Record<string, string[]>) => void;
  onValueLabelsChange: (labels: Record<string, string[]>) => void;
};

type ModelModeProps = {
  mode: 'model';
  form: UseFormReturn<MaterialModelFormValues>;
};

export function MaterialSpecificationsTable(
  props: MaterialModeProps | ModelModeProps,
) {
  if (props.mode === 'model') {
    return <MaterialModelSpecificationsEditorTable form={props.form} />;
  }

  return <MaterialSpecificationsMaterialMode {...props} />;
}

function MaterialSpecificationsMaterialMode({
  specifications,
  values,
  valueLabels,
  onChange,
  onValueLabelsChange,
}: Omit<MaterialModeProps, 'mode'>) {
  const intl = useIntl();
  const [editableRows, setEditableRows] = useState<Record<string, boolean>>({});
  const configuredSpecifications = (specifications ?? [])
    .map((specification) => ({
      ...specification,
      values: specification.values.filter((value) => value.trim().length > 0),
    }))
    .filter((specification) => specification.values.length > 0);

  return (
    <MaterialSpecificationsEditorTableView
      mode="material"
      count={configuredSpecifications.length}
      emptyState={
        <span className="text-muted-foreground">
          {intl.formatMessage({
            id:
              specifications === null
                ? 'project.materials.form.chooseModelHint'
                : 'project.materials.empty.specifications',
          })}
        </span>
      }
    >
      {configuredSpecifications.map((specification, index) => {
        const selectedValues =
          values[specification.id] ??
          (specification.values.length === 1 ? [specification.values[0]] : []);
        const labelsByValue = new Map(
          specification.values.map((value, valueIndex) => [
            value,
            specification.valueLabels[valueIndex],
          ]),
        );
        const selectedLabels = selectedValues.map((value, valueIndex) =>
          Object.prototype.hasOwnProperty.call(
            valueLabels[specification.id] ?? [],
            valueIndex,
          )
            ? valueLabels[specification.id][valueIndex]
            : (labelsByValue.get(value) ?? ''),
        );
        const isEditable = editableRows[specification.id] ?? false;
        const updateSpecificationValues = (nextValues: string[]) => {
          const next = { ...values };
          if (nextValues.length === 0) delete next[specification.id];
          else next[specification.id] = nextValues;
          onChange(next);

          if (specification.dataType === 'color') {
            const nextLabels = nextValues.map((value, valueIndex) => {
              const currentIndex = selectedValues.indexOf(value);
              if (currentIndex >= 0) return selectedLabels[currentIndex] ?? '';
              return (
                labelsByValue.get(value) ?? selectedLabels[valueIndex] ?? ''
              );
            });
            const nextLabelOverrides = { ...valueLabels };
            if (nextLabels.length === 0) {
              delete nextLabelOverrides[specification.id];
            } else {
              nextLabelOverrides[specification.id] = nextLabels;
            }
            onValueLabelsChange(nextLabelOverrides);
          }
        };
        const updateSpecificationLabels = (nextLabels: string[]) => {
          const next = { ...valueLabels };
          if (nextLabels.length === 0) delete next[specification.id];
          else next[specification.id] = nextLabels;
          onValueLabelsChange(next);
        };
        const displayValue = selectedValues[0] ?? specification.values[0] ?? '';
        const hasCustomDisplayLabel = Object.prototype.hasOwnProperty.call(
          valueLabels[specification.id] ?? [],
          0,
        );
        const displayLabel = hasCustomDisplayLabel
          ? selectedLabels[0]?.trim() || displayValue
          : labelsByValue.get(displayValue) || displayValue;

        return (
          <MaterialSpecificationsEditorTableRow
            key={specification.id}
            mode="material"
            edit={
              <Checkbox
                checked={isEditable}
                aria-label={intl.formatMessage(
                  { id: 'project.materials.fields.specificationEditLabel' },
                  { name: specification.name },
                )}
                onCheckedChange={(checked) =>
                  setEditableRows((current) => ({
                    ...current,
                    [specification.id]: checked === true,
                  }))
                }
              />
            }
            name={
              <div className="flex min-w-0 items-center gap-2">
                <MaterialSpecificationDataTypeIcon
                  dataType={specification.dataType}
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 truncate font-medium">
                  {specification.name}
                </span>
              </div>
            }
            value={
              !isEditable && specification.values.length === 1 ? (
                specification.dataType === 'color' ? (
                  <div className="flex min-w-0 items-center gap-2 py-1">
                    <span
                      aria-hidden="true"
                      className="size-5 shrink-0 rounded-sm border border-black/10"
                      style={{ backgroundColor: displayValue }}
                    />
                    <span className="min-w-0 truncate text-sm">
                      {displayLabel}
                    </span>
                  </div>
                ) : (
                  <span className="block min-w-0 py-1 text-sm">
                    {displayValue}
                  </span>
                )
              ) : (
                <MaterialModelSpecificationValues
                  mode="material"
                  canEdit={isEditable}
                  dataType={specification.dataType}
                  isList={specification.isList}
                  values={selectedValues}
                  valueLabels={selectedLabels}
                  suggestions={specification.values.map(
                    (value, valueIndex) => ({
                      id: `${specification.id}-${valueIndex}`,
                      label: value,
                      name: specification.valueLabels[valueIndex],
                    }),
                  )}
                  rowIndex={index}
                  fieldLabel={specification.name}
                  onChange={updateSpecificationValues}
                  onValueLabelsChange={updateSpecificationLabels}
                />
              )
            }
          />
        );
      })}
    </MaterialSpecificationsEditorTableView>
  );
}
