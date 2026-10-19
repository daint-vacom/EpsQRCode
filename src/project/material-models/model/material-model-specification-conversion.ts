import { getMaterialSpecificationUnits } from '@/project/material-specifications/model/material-specification';
import type { MaterialSpecificationDataType } from '@/project/material-specifications/model/material-specification';

function getDefaultUnit(dataType: MaterialSpecificationDataType) {
  return dataType === 'length' ? 'm' : 'kg';
}

function convertMeasurementValue(
  value: string,
  dataType: 'length' | 'weight',
): string {
  const match = value
    .trim()
    .match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(\p{L}+)?$/iu);
  if (!match) return '';

  const amount = match[1];
  const enteredUnit = match[2]?.toLowerCase();
  const matchingUnit = getMaterialSpecificationUnits(dataType).find(
    (option) => option.toLowerCase() === enteredUnit,
  );
  const unit =
    matchingUnit ??
    (dataType === 'weight' && enteredUnit === 'tấn' ? 't' : undefined);

  return `${amount} ${unit ?? getDefaultUnit(dataType)}`;
}

function convertBooleanValue(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('vi');
  return ['true', '1', 'yes', 'có'].includes(normalized) ? 'true' : 'false';
}

export function convertMaterialModelSpecificationValues(
  values: string[],
  fromType: MaterialSpecificationDataType,
  toType: MaterialSpecificationDataType,
): string[] {
  if (fromType === toType) return values;

  if (toType === 'length' || toType === 'weight') {
    return values.map((value) => convertMeasurementValue(value, toType));
  }

  if (toType === 'boolean') {
    return values.length > 0 ? [convertBooleanValue(values[0])] : ['false'];
  }

  if (fromType === 'length' || fromType === 'weight') {
    return values.map((value) => convertMeasurementValue(value, fromType));
  }

  if (fromType === 'boolean') {
    if (toType === 'text') {
      return values.map((value) => (value === 'true' ? 'Có' : 'Không'));
    }
    if (toType === 'number') {
      return values.map((value) => (value === 'true' ? '1' : '0'));
    }
    return values.map(() => '');
  }

  return values;
}
