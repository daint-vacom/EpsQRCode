import {
  PROJECT_TAG_GROUP_ENTITY_ORDER,
  type ProjectEntity,
} from '@/config/project-menu.config';
import {
  CONTRACT_TAG_GROUP_CODE,
  CUSTOMER_TAG_GROUP_CODE,
  EMPLOYEE_TAG_GROUP_CODE,
  WORK_TAG_GROUP_CODE,
  type TagGroup,
} from './tag';

const SYSTEM_TAG_GROUP_ENTITY_BY_CODE: Readonly<Record<string, ProjectEntity>> =
  {
    [CUSTOMER_TAG_GROUP_CODE]: 'customer',
    [CONTRACT_TAG_GROUP_CODE]: 'contract',
    [WORK_TAG_GROUP_CODE]: 'work',
    [EMPLOYEE_TAG_GROUP_CODE]: 'employee',
  };

function compareByStoredOrder(left: TagGroup, right: TagGroup) {
  return (
    left.sortOrder - right.sortOrder ||
    left.name.localeCompare(right.name, 'vi')
  );
}

/** System groups follow the sidebar order; custom groups are listed afterward. */
export function sortTagGroups(groups: readonly TagGroup[]): TagGroup[] {
  const entityOrder = new Map(
    PROJECT_TAG_GROUP_ENTITY_ORDER.map((entity, index) => [entity, index]),
  );

  return [...groups].sort((left, right) => {
    if (left.isSystem !== right.isSystem) {
      return left.isSystem ? -1 : 1;
    }

    if (left.isSystem && right.isSystem) {
      const leftEntity = SYSTEM_TAG_GROUP_ENTITY_BY_CODE[left.code];
      const rightEntity = SYSTEM_TAG_GROUP_ENTITY_BY_CODE[right.code];
      const leftIndex = leftEntity
        ? (entityOrder.get(leftEntity) ?? PROJECT_TAG_GROUP_ENTITY_ORDER.length)
        : PROJECT_TAG_GROUP_ENTITY_ORDER.length;
      const rightIndex = rightEntity
        ? (entityOrder.get(rightEntity) ??
          PROJECT_TAG_GROUP_ENTITY_ORDER.length)
        : PROJECT_TAG_GROUP_ENTITY_ORDER.length;

      return leftIndex - rightIndex || compareByStoredOrder(left, right);
    }

    return compareByStoredOrder(left, right);
  });
}
