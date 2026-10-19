import { describe, expect, it } from 'vitest';
import { convertMaterialModelSpecificationValues } from './material-model-specification-conversion';

describe('material model color specification conversion', () => {
  it('uses the displayed default color when switching an empty row to color', () => {
    expect(
      convertMaterialModelSpecificationValues([], 'text', 'color'),
    ).toEqual(['#1677ff']);
  });

  it('normalizes existing hex colors and drops values that are not colors', () => {
    expect(
      convertMaterialModelSpecificationValues(
        ['#abc', 'not a color', '#9C27B0'],
        'text',
        'color',
      ),
    ).toEqual(['#aabbcc', '#9c27b0']);
  });
});
