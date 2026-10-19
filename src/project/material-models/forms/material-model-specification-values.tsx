import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { MaterialSpecificationDataType } from '@/project/material-specifications/model/material-specification';
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

interface MaterialModelSpecificationValuesProps {
  dataType: MaterialSpecificationDataType;
  isList: boolean;
  values: string[];
  suggestions?: string[];
  rowIndex: number;
  onChange: (values: string[]) => void;
}

export function MaterialModelSpecificationValues({
  dataType,
  isList,
  values,
  suggestions = [],
  rowIndex,
  onChange,
}: MaterialModelSpecificationValuesProps) {
  const intl = useIntl();
  const [newValue, setNewValue] = useState(
    dataType === 'boolean' ? 'false' : '',
  );
  const [unitDrafts, setUnitDrafts] = useState<Record<string, string>>({});
  const visibleValues = values;
  const rowLabel = (valueIndex: number) =>
    `${intl.formatMessage({ id: 'materialModels.specifications.values' })} ${rowIndex + 1}.${valueIndex + 1}`;

  useEffect(() => {
    setNewValue(dataType === 'boolean' ? 'false' : '');
    setUnitDrafts({});
  }, [dataType, isList]);

  const addValue = () => {
    const nextValue = newValue.trim();
    if (!nextValue) return;
    onChange([...values, nextValue]);
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
    onValueChange: (value: string) => void,
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
              key={suggestion}
              onSelect={() => onValueChange(suggestion)}
            >
              {suggestion}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const renderValueInput = (
    value: string,
    onValueChange: (value: string) => void,
    ariaLabel: string,
    isNewValue = false,
  ) => {
    const handleSuggestionSelect = (suggestion: string) => {
      if (isNewValue) {
        onChange([...values, suggestion]);
        setNewValue(dataType === 'boolean' ? 'false' : '');
        return;
      }
      onValueChange(suggestion);
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
          onBlur={isNewValue ? addValue : undefined}
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
        <div className="flex w-full min-w-0 items-center">
          <ColorInput
            value={value}
            onValueChange={onValueChange}
            onKeyDown={isNewValue ? handleNewValueKeyDown : undefined}
            onBlur={isNewValue ? addValue : undefined}
            aria-label={ariaLabel}
            pickerLabel={intl.formatMessage({
              id: 'materialSpecifications.fields.colorPicker',
            })}
            variant="md"
            className="w-full min-w-0"
          />
          {suggestionMenu(handleSuggestionSelect, ariaLabel)}
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
            {suggestionMenu(handleSuggestionSelect, ariaLabel)}
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
          onBlur={isNewValue ? addValue : undefined}
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
        {suggestionMenu(handleSuggestionSelect, ariaLabel)}
      </div>
    );
  };

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
