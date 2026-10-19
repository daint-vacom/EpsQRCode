import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type {
  MaterialSpecificationDataType,
  MaterialSpecificationOption,
} from '@/project/material-specifications/model/material-specification';
import { getMaterialSpecificationUnits } from '@/project/material-specifications/model/material-specification';
import { ChevronDown, Plus, X } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ColorInput } from '@/components/ui/color-input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DEFAULT_SPECIFICATION_COLOR = '#1677ff';

interface MaterialModelSpecificationValuesProps {
  mode?: 'model' | 'material';
  canEdit?: boolean;
  dataType: MaterialSpecificationDataType;
  isList: boolean;
  values: string[];
  valueLabels?: string[];
  suggestions?: MaterialSpecificationOption[];
  rowIndex: number;
  fieldLabel?: string;
  onChange: (values: string[]) => void;
  onValueLabelsChange?: (labels: string[]) => void;
}

export function MaterialModelSpecificationValues({
  mode = 'model',
  canEdit = true,
  dataType,
  isList,
  values,
  valueLabels = [],
  suggestions = [],
  rowIndex,
  fieldLabel,
  onChange,
  onValueLabelsChange,
}: MaterialModelSpecificationValuesProps) {
  const intl = useIntl();
  const [newValue, setNewValue] = useState(
    dataType === 'boolean' ? 'false' : '',
  );
  const [unitDrafts, setUnitDrafts] = useState<Record<string, string>>({});
  const visibleValues = values;
  const rowLabel = (valueIndex: number) =>
    fieldLabel
      ? isList
        ? `${fieldLabel} ${valueIndex + 1}`
        : fieldLabel
      : `${intl.formatMessage({ id: 'materialModels.specifications.values' })} ${rowIndex + 1}.${valueIndex + 1}`;

  useEffect(() => {
    setNewValue(dataType === 'boolean' ? 'false' : '');
    setUnitDrafts({});
  }, [dataType, isList]);

  const addValue = (value = newValue) => {
    const nextValue = value.trim();
    if (!nextValue) return;
    if (mode === 'material') {
      if (isList) {
        if (!values.includes(nextValue)) onChange([...values, nextValue]);
      } else {
        onChange([nextValue]);
      }
    } else {
      onChange([...values, nextValue]);
    }
    setNewValue(dataType === 'boolean' ? 'false' : '');
  };

  const handleNewValueKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    addValue();
  };

  const defaultUnit = dataType === 'length' ? 'm' : 'kg';
  const units = getMaterialSpecificationUnits(dataType);
  const parseMeasurementValue = (value: string, key: string) => {
    const matchingUnits = [...units].sort(
      (left, right) => right.length - left.length,
    );
    const matchedUnit = matchingUnits.find((unit) =>
      new RegExp(`\\s*${unit}$`, 'i').test(value.trim()),
    );
    const hasTonneAlias =
      dataType === 'weight' && /\s*tấn$/i.test(value.trim());
    const unit =
      matchedUnit ?? (hasTonneAlias ? 't' : unitDrafts[key]) ?? defaultUnit;
    const amount = matchedUnit
      ? value.trim().slice(0, -matchedUnit.length).trim()
      : hasTonneAlias
        ? value
            .trim()
            .replace(/\s*tấn$/i, '')
            .trim()
        : value.trim();

    return { amount, unit };
  };

  const serializeMeasurementValue = (amount: string, unit: string) =>
    amount.trim() ? `${amount.trim()} ${unit}` : '';

  const suggestionMenu = (
    onSuggestionSelect: (suggestion: MaterialSpecificationOption) => void,
    ariaLabel: string,
  ) =>
    suggestions.length > 0 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            mode="icon"
            size="sm"
            className="shrink-0"
            aria-label={`${ariaLabel} - ${intl.formatMessage({ id: 'materialModels.specifications.chooseSuggestion' })}`}
          >
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {suggestions.map((suggestion) => (
            <DropdownMenuItem
              key={suggestion.id}
              onSelect={() => onSuggestionSelect(suggestion)}
            >
              {suggestion.name?.trim() || suggestion.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const handleColorSuggestionSelect = (
    suggestion: MaterialSpecificationOption,
    valueIndex: number,
  ) => {
    const nextValues = [...values];
    nextValues[valueIndex] = suggestion.label;
    onChange(nextValues);

    const nextLabels = [...valueLabels];
    while (nextLabels.length <= valueIndex) nextLabels.push('');
    nextLabels[valueIndex] = suggestion.name?.trim() ?? '';
    onValueLabelsChange?.(nextLabels);
  };

  const renderValueInput = (
    value: string,
    onValueChange: (value: string) => void,
    ariaLabel: string,
    isNewValue = false,
    showSuggestions = true,
  ) => {
    const handleSuggestionSelect = (
      suggestion: MaterialSpecificationOption,
    ) => {
      const nextValue = suggestion.label;
      if (isNewValue) {
        onChange([...values, nextValue]);
        setNewValue(dataType === 'boolean' ? 'false' : '');
        return;
      }
      onValueChange(nextValue);
    };

    if (dataType === 'boolean') {
      return (
        <label className="flex h-8.5 w-full min-w-0 items-center gap-2 text-sm">
          <Checkbox
            size="sm"
            checked={value === 'true'}
            onCheckedChange={(checked) =>
              onValueChange(checked === true ? 'true' : 'false')
            }
            aria-label={ariaLabel}
          />
          <span>
            {intl.formatMessage({
              id:
                value === 'true'
                  ? 'materialModels.specifications.boolean.yes'
                  : 'materialModels.specifications.boolean.no',
            })}
          </span>
        </label>
      );
    }

    if (dataType === 'date') {
      return (
        <DatePickerInput
          value={value || undefined}
          valueMode="iso-date"
          onChange={(nextValue) =>
            onValueChange(typeof nextValue === 'string' ? nextValue : '')
          }
          onKeyDown={isNewValue ? handleNewValueKeyDown : undefined}
          onBlur={isNewValue ? () => addValue() : undefined}
          aria-label={ariaLabel}
          calendarLabel={intl.formatMessage({
            id: 'materialSpecifications.fields.chooseDate',
          })}
          variant="md"
          className="w-full min-w-0"
        />
      );
    }

    if (dataType === 'color') {
      return (
        <div className="flex w-fit min-w-0 items-center">
          <ColorInput
            value={value}
            onValueChange={onValueChange}
            onKeyDown={isNewValue ? handleNewValueKeyDown : undefined}
            onBlur={isNewValue ? () => addValue() : undefined}
            aria-label={ariaLabel}
            pickerLabel={intl.formatMessage({
              id: 'materialSpecifications.fields.colorPicker',
            })}
            variant="md"
            className="shrink-0"
          />
        </div>
      );
    }

    if (dataType === 'length' || dataType === 'weight') {
      const measurementKey = isNewValue ? 'new' : ariaLabel;
      const measurement = parseMeasurementValue(value, measurementKey);
      return (
        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-2">
          <div className="flex min-w-0 items-center">
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={measurement.amount}
              onChange={(event) => {
                setUnitDrafts((current) => ({
                  ...current,
                  [measurementKey]: measurement.unit,
                }));
                onValueChange(
                  serializeMeasurementValue(
                    event.target.value,
                    measurement.unit,
                  ),
                );
              }}
              onKeyDown={isNewValue ? handleNewValueKeyDown : undefined}
              placeholder={
                isNewValue
                  ? intl.formatMessage({
                      id: 'materialModels.specifications.addValuePlaceholder',
                    })
                  : undefined
              }
              aria-label={ariaLabel}
              variant="ghost-underline"
              className="w-full min-w-0 text-right tabular-nums"
            />
            {showSuggestions
              ? suggestionMenu(handleSuggestionSelect, ariaLabel)
              : null}
          </div>
          <Select
            value={measurement.unit}
            onValueChange={(unit) => {
              setUnitDrafts((current) => ({
                ...current,
                [measurementKey]: unit,
              }));
              if (measurement.amount.trim()) {
                onValueChange(
                  serializeMeasurementValue(measurement.amount, unit),
                );
              }
            }}
          >
            <SelectTrigger
              size="md"
              variant="ghost"
              className="w-full min-w-0 px-2"
              aria-label={`${ariaLabel} - ${intl.formatMessage({ id: 'materialSpecifications.fields.unit' })}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div className="flex w-full min-w-0 items-center">
        <Input
          type={dataType === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={isNewValue ? handleNewValueKeyDown : undefined}
          onBlur={isNewValue ? () => addValue() : undefined}
          placeholder={
            isNewValue
              ? intl.formatMessage({
                  id: 'materialModels.specifications.addValuePlaceholder',
                })
              : undefined
          }
          aria-label={ariaLabel}
          variant={dataType === 'text' ? 'ghost-underline' : 'md'}
          className={`w-full min-w-0 ${dataType === 'number' ? 'text-right tabular-nums' : ''}`}
        />
        {showSuggestions
          ? suggestionMenu(handleSuggestionSelect, ariaLabel)
          : null}
      </div>
    );
  };

  if (mode === 'material') {
    if (suggestions.length === 1) {
      const suggestion = suggestions[0];
      const value = values[0] ?? suggestion.label;

      if (!canEdit) {
        const label =
          valueLabels[0]?.trim() || suggestion.name?.trim() || value;
        return dataType === 'color' ? (
          <div className="flex min-w-0 items-center gap-2 py-1">
            <span
              aria-hidden="true"
              className="size-5 shrink-0 rounded-sm border border-black/10"
              style={{ backgroundColor: value }}
            />
            <span className="min-w-0 truncate text-sm">{label}</span>
          </div>
        ) : (
          <span className="block min-w-0 py-1 text-sm">{value}</span>
        );
      }

      if (dataType === 'color') {
        return (
          <div className="flex w-full min-w-0 items-center gap-2">
            {renderValueInput(
              value,
              (nextValue) => onChange([nextValue]),
              rowLabel(0),
              false,
              false,
            )}
            <Input
              value={valueLabels[0] ?? suggestion.name ?? ''}
              onChange={(event) => {
                onChange(values.length > 0 ? values : [value]);
                onValueLabelsChange?.([event.target.value]);
              }}
              aria-label={`${intl.formatMessage({ id: 'materialModels.specifications.colorLabel' })} 1`}
              placeholder={intl.formatMessage({
                id: 'materialModels.specifications.colorLabel',
              })}
              variant="ghost-underline"
              className="min-w-0 flex-1"
            />
          </div>
        );
      }

      return (
        <div className="flex w-full min-w-0 items-center gap-2">
          {renderValueInput(
            value,
            (nextValue) => onChange([nextValue]),
            rowLabel(0),
            false,
            false,
          )}
        </div>
      );
    }

    const suggestionValues = new Set(
      suggestions.map((suggestion) => suggestion.label),
    );
    const customValues = values.filter((value) => !suggestionValues.has(value));
    const addButtonLabel = intl.formatMessage({
      id: 'materialModels.specifications.addValue',
    });

    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        {canEdit && dataType === 'color' ? (
          <Button
            type="button"
            variant="outline"
            mode="icon"
            size="sm"
            className="size-8 shrink-0"
            aria-label={addButtonLabel}
            title={addButtonLabel}
            onClick={() => {
              const nextValues = isList
                ? values.includes(DEFAULT_SPECIFICATION_COLOR)
                  ? values
                  : [...values, DEFAULT_SPECIFICATION_COLOR]
                : [DEFAULT_SPECIFICATION_COLOR];
              if (nextValues.length === values.length && isList) return;
              onChange(nextValues);
              onValueLabelsChange?.(
                isList
                  ? [...values.map((_, index) => valueLabels[index] ?? ''), '']
                  : [''],
              );
            }}
          >
            <Plus />
          </Button>
        ) : canEdit && dataType === 'boolean' ? (
          <div className="flex min-w-0 items-center gap-2">
            {renderValueInput(
              newValue,
              setNewValue,
              rowLabel(0),
              dataType === 'boolean',
              false,
            )}
            <Button
              type="button"
              variant="outline"
              mode="icon"
              size="sm"
              className="shrink-0"
              aria-label={addButtonLabel}
              title={addButtonLabel}
              onClick={() =>
                addValue(
                  dataType === 'color'
                    ? newValue || DEFAULT_SPECIFICATION_COLOR
                    : newValue,
                )
              }
            >
              <Plus />
            </Button>
          </div>
        ) : canEdit ? (
          renderValueInput(newValue, setNewValue, rowLabel(0), true, false)
        ) : null}

        {customValues.map((value, index) => {
          const valueIndex = values.indexOf(value);
          const displayValue = valueLabels[valueIndex]?.trim() || value;

          if (dataType === 'color' && canEdit) {
            return (
              <div
                key={`${value}-${index}`}
                className="flex min-w-0 items-center gap-2 py-1"
              >
                <div className="group/color relative size-9 shrink-0">
                  {renderValueInput(
                    value,
                    (nextValue) => {
                      const nextValues = [...values];
                      nextValues[valueIndex] = nextValue;
                      onChange(nextValues);
                    },
                    rowLabel(valueIndex),
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    mode="icon"
                    size="icon"
                    className="absolute -top-1 -right-1 z-10 size-5 rounded-full border border-background p-0 opacity-0 shadow-sm transition-opacity group-hover/color:opacity-100 focus-visible:opacity-100"
                    aria-label={intl.formatMessage(
                      { id: 'materialModels.specifications.removeValue' },
                      { index: index + 1 },
                    )}
                    onClick={() => {
                      onChange(
                        values.filter(
                          (_, itemIndex) => itemIndex !== valueIndex,
                        ),
                      );
                      onValueLabelsChange?.(
                        valueLabels.filter(
                          (_, itemIndex) => itemIndex !== valueIndex,
                        ),
                      );
                    }}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
                <Input
                  value={valueLabels[valueIndex] ?? ''}
                  onChange={(event) => {
                    const nextLabels = values.map(
                      (_, itemIndex) => valueLabels[itemIndex] ?? '',
                    );
                    nextLabels[valueIndex] = event.target.value;
                    onValueLabelsChange?.(nextLabels);
                  }}
                  aria-label={`${intl.formatMessage({ id: 'materialModels.specifications.colorLabel' })} ${index + 1}`}
                  placeholder={intl.formatMessage({
                    id: 'materialModels.specifications.colorLabel',
                  })}
                  variant="ghost-underline"
                  className="min-w-0 flex-1"
                />
              </div>
            );
          }

          return (
            <div
              key={`${value}-${index}`}
              className="flex min-w-0 items-center gap-2 py-1"
            >
              {dataType === 'color' ? (
                <span
                  aria-hidden="true"
                  className="size-5 shrink-0 rounded-sm border border-black/10"
                  style={{ backgroundColor: value }}
                />
              ) : null}
              <span className="min-w-0 flex-1 truncate text-sm">
                {displayValue}
              </span>
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  mode="icon"
                  size="sm"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={intl.formatMessage(
                    { id: 'materialModels.specifications.removeValue' },
                    { index: index + 1 },
                  )}
                  onClick={() =>
                    onChange(
                      values.filter((_, itemIndex) => itemIndex !== valueIndex),
                    )
                  }
                >
                  <X />
                </Button>
              ) : null}
            </div>
          );
        })}

        {suggestions.map((suggestion) => {
          const checked = values.includes(suggestion.label);
          const displayValue = suggestion.name?.trim() || suggestion.label;

          return (
            <label
              key={suggestion.id}
              className="flex min-w-0 items-center gap-2 py-1"
            >
              <Checkbox
                checked={checked}
                aria-label={displayValue}
                onCheckedChange={(nextChecked) => {
                  if (isList) {
                    onChange(
                      nextChecked === true
                        ? values.includes(suggestion.label)
                          ? values
                          : [...values, suggestion.label]
                        : values.filter((value) => value !== suggestion.label),
                    );
                    return;
                  }
                  onChange(nextChecked === true ? [suggestion.label] : []);
                }}
              />
              {dataType === 'color' ? (
                <span
                  aria-hidden="true"
                  className="size-5 shrink-0 rounded-sm border border-black/10"
                  style={{ backgroundColor: suggestion.label }}
                />
              ) : null}
              <span className="min-w-0 truncate text-sm">{displayValue}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (dataType === 'color') {
    const colorValues = isList ? visibleValues : [values[0] ?? ''];
    const colorLabels = isList ? valueLabels : [valueLabels[0] ?? ''];

    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        {colorValues.map((value, index) => (
          <div
            key={`${rowIndex}-${index}`}
            className="flex w-full min-w-0 items-center gap-2"
          >
            <div className="group/color relative size-9 shrink-0">
              {renderValueInput(
                value,
                (nextValue) => {
                  const nextValues = [...values];
                  nextValues[index] = nextValue;
                  onChange(nextValues);
                },
                rowLabel(index),
              )}
              {isList ? (
                <Button
                  type="button"
                  variant="destructive"
                  mode="icon"
                  size="icon"
                  className="absolute -top-1 -right-1 z-10 size-5 rounded-full border border-background p-0 opacity-0 shadow-sm transition-opacity group-hover/color:opacity-100 focus-visible:opacity-100"
                  aria-label={intl.formatMessage(
                    { id: 'materialModels.specifications.removeValue' },
                    { index: index + 1 },
                  )}
                  onClick={() => {
                    onChange(
                      values.filter((_, itemIndex) => itemIndex !== index),
                    );
                    onValueLabelsChange?.(
                      valueLabels.filter((_, itemIndex) => itemIndex !== index),
                    );
                  }}
                >
                  <X className="size-3" />
                </Button>
              ) : null}
            </div>
            {suggestionMenu(
              (suggestion) => handleColorSuggestionSelect(suggestion, index),
              rowLabel(index),
            )}
            <div className="flex min-w-0 flex-1">
              <Input
                value={colorLabels[index] ?? ''}
                onChange={(event) => {
                  const nextLabels = values.map(
                    (_, itemIndex) => valueLabels[itemIndex] ?? '',
                  );
                  nextLabels[index] = event.target.value;
                  onValueLabelsChange?.(nextLabels);
                }}
                readOnly={!onValueLabelsChange}
                aria-label={`${intl.formatMessage({ id: 'materialModels.specifications.colorLabel' })} ${index + 1}`}
                placeholder={intl.formatMessage({
                  id: 'materialModels.specifications.colorLabel',
                })}
                variant="ghost-underline"
                className="min-w-0"
              />
            </div>
          </div>
        ))}

        {isList ? (
          <Button
            type="button"
            variant="outline"
            mode="icon"
            size="icon"
            className="size-8 shrink-0 self-start"
            aria-label={intl.formatMessage({
              id: 'materialModels.specifications.addValue',
            })}
            title={intl.formatMessage({
              id: 'materialModels.specifications.addValue',
            })}
            onClick={() => {
              onChange([...values, DEFAULT_SPECIFICATION_COLOR]);
              onValueLabelsChange?.([...valueLabels, '']);
            }}
          >
            <Plus className="size-4" />
          </Button>
        ) : null}
      </div>
    );
  }

  if (!isList) {
    return renderValueInput(
      values[0] ?? '',
      (value) => onChange([value]),
      rowLabel(0),
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      {visibleValues.map((value, index) => (
        <div
          key={`${rowIndex}-${index}`}
          className="flex w-full min-w-0 items-center gap-2"
        >
          {renderValueInput(
            value,
            (nextValue) => {
              const nextValues = [...values];
              nextValues[index] = nextValue;
              onChange(nextValues);
            },
            rowLabel(index),
          )}
          <Button
            type="button"
            variant="ghost"
            mode="icon"
            size="icon"
            className="size-7 shrink-0 rounded-sm text-muted-foreground hover:text-destructive"
            aria-label={intl.formatMessage(
              { id: 'materialModels.specifications.removeValue' },
              { index: index + 1 },
            )}
            onClick={() =>
              onChange(values.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ))}

      <div className="flex w-full min-w-0 items-center gap-2">
        {renderValueInput(
          newValue,
          (value) => {
            if (dataType === 'boolean') {
              setNewValue(value);
            } else {
              setNewValue(value);
            }
          },
          intl.formatMessage({ id: 'materialModels.specifications.addValue' }),
          true,
        )}
        {dataType === 'boolean' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            aria-label={intl.formatMessage({
              id: 'materialModels.specifications.addValue',
            })}
            onClick={addValue}
          >
            <Plus />
            {intl.formatMessage({
              id: 'materialModels.specifications.addValue',
            })}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
