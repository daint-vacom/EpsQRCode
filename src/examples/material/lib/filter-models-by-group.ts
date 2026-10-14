import { getSelfAndDescendantIds } from '../groups/group-tree';
import type { MaterialGroup } from '../model/material-group';
import type { ExampleMaterialModel } from '../model/material-model';

export function filterModelsByGroup(
  models: ExampleMaterialModel[],
  groups: MaterialGroup[],
  groupId: string | null,
): ExampleMaterialModel[] {
  if (!groupId) return models;
  const ids = getSelfAndDescendantIds(groups, groupId);
  return models.filter((model) => ids.has(model.groupId));
}
