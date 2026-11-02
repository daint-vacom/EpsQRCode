import { useEffect, useState } from 'react';
import { MaterialSpecificationDataTypeIcon } from '@/project/material-specifications/components/material-specification-data-type-icon';
import type { UseFormReturn } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
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
  publicVisibilityDisabled?: boolean;
  specifications: MaterialModelSpecification[] | null;
  values: Record<string, string[]>;
  valueLabels: Record<string, string[]>;
  publicSettings: Record<string, boolean>;
  onPublicSettingsChange: (settings: Record<string, boolean>) => void;
  onChange: (values: Record<string, string[]>) => void;
  onValueLabelsChange: (labels: Record<string, string[]>) => void;
  onRemoveSpecifications: (ids: string[]) => void;
};

type ModelModeProps = {
  mode: 'model';
  form: UseFormReturn<MaterialModelFormValues>;
  publicVisibilityDisabled?: boolean;
};

export function MaterialSpecificationsTable(
  props: MaterialModeProps | ModelModeProps,
) {
  if (props.mode === 'model') {
    return (
      <MaterialModelSpecificationsEditorTable
        form={props.form}
        publicVisibilityDisabled={props.publicVisibilityDisabled}
      />
    );
  }

  return <MaterialSpecificationsMaterialMode {...props} />;
}

function MaterialSpecificationsMaterialMode({
  specifications,
  values,
  valueLabels,
  onChange,
  onValueLabelsChange,
  publicSettings,
  onPublicSettingsChange,
  publicVisibilityDisabled,
  onRemoveSpecifications,
}: Omit<MaterialModeProps, 'mode'>) {
  const intl = useIntl();
  const [editableRows, setEditableRows] = useState<Record<string, boolean>>({});
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectionAction, setSelectionAction] = useState('delete');
  const configuredSpecifications = (specifications ?? [])
    .map((specification) => ({
      ...specification,
      values: specification.values.filter((value) => value.trim().length > 0),
    }))
    .filter((specification) => specification.values.length > 0);
  const selectedRowIds = new Set(selectedRows);
  const selectedCount = configuredSpecifications.filter((specification) =>
    selectedRowIds.has(specification.id),
  ).length;
  const allSelected =
    configuredSpecifications.length > 0 &&
    selectedCount === configuredSpecifications.length;
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    const specificationIds = new Set(
      (specifications ?? [])
        .filter((specification) =>
          specification.values.some((value) => value.trim().length > 0),
        )
        .map((specification) => specification.id),
    );
    setSelectedRows((current) => {
      const next = current.filter((id) => specificationIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [specifications]);

  const handleApplySelectionAction = (action: string) => {
    if (action === 'delete') {
      const deletedIds = configuredSpecifications
        .filter((specification) => selectedRowIds.has(specification.id))
        .map((specification) => specification.id);
      if (deletedIds.length === 0) return;
      onRemoveSpecifications(deletedIds);
      setSelectedRows([]);
      toast.success(
        intl.formatMessage(
          { id: 'materialModels.specifications.selection.deletedMaterial' },
          { count: deletedIds.length },
        ),
      );
    }
  };

  return (
    <MaterialSpecificationsEditorTableView
      mode="material"
      count={configuredSpecifications.length}
      selectedCount={selectedCount}
      allSelected={allSelected}
      someSelected={someSelected}
      onToggleAll={(checked) =>
        setSelectedRows(
          checked
            ? configuredSpecifications.map((specification) => specification.id)
            : [],
        )
      }
      selectionAction={selectionAction}
      onSelectionActionChange={setSelectionAction}
      onApplySelectionAction={handleApplySelectionAction}
      onClearSelection={() => setSelectedRows([])}
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
            selection={
              <Checkbox
                checked={selectedRowIds.has(specification.id)}
                aria-label={intl.formatMessage(
                  {
                    id: 'materialModels.specifications.selection.selectRow',
                  },
                  { name: specification.name },
                )}
                onCheckedChange={(checked) =>
                  setSelectedRows((current) =>
                    checked === true
                      ? current.includes(specification.id)
                        ? current
                        : [...current, specification.id]
                      : current.filter((id) => id !== specification.id),
                  )
                }
              />
            }
            visible={
              <Switch
                disabled={publicVisibilityDisabled}
                checked={
                  publicSettings[specification.id] ?? specification.isPublic
                }
                aria-label={intl.formatMessage(
                  { id: 'project.materials.fields.specificationPublicLabel' },
                  { name: specification.name },
                )}
                onCheckedChange={(isPublic) =>
                  onPublicSettingsChange({
                    ...publicSettings,
                    [specification.id]: isPublic,
                  })
                }
              />
            }
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
