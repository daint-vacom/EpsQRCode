import { describe, expect, it } from 'vitest';
import type { TagGroup } from './tag';
import { sortTagGroups } from './tag-group-order';

function group(code: string, isSystem: boolean, sortOrder: number): TagGroup {
  return {
    id: code,
    code,
    name: code,
    description: '',
    moduleCode: null,
    moduleName: null,
    isSystem,
    sortOrder,
    isActive: true,
    tagCount: 0,
  };
}

describe('sortTagGroups', () => {
  it('puts system groups in sidebar order before custom groups', () => {
    const groups = [
      group('custom-later', false, 1),
      group('employees', true, 5),
      group('custom-first', false, 0),
    ];

    expect(sortTagGroups(groups).map((item) => item.code)).toEqual([
      'employees',
      'custom-first',
      'custom-later',
    ]);
  });
});
