import type { MaterialGroup } from './material-group';

export interface MaterialGroupTreeNode extends MaterialGroup {
  children: MaterialGroupTreeNode[];
  depth: number;
}

export function buildMaterialGroupTree(
  groups: MaterialGroup[],
): MaterialGroupTreeNode[] {
  const byId = new Map<string, MaterialGroupTreeNode>();
  for (const group of groups) {
    byId.set(group.id, { ...group, children: [], depth: 0 });
  }

  const roots: MaterialGroupTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }

  const sortNodes = (nodes: MaterialGroupTreeNode[], depth: number) => {
    nodes.sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'vi') || a.code.localeCompare(b.code),
    );
    for (const node of nodes) {
      node.depth = depth;
      sortNodes(node.children, depth + 1);
    }
  };
  sortNodes(roots, 0);

  return roots;
}

export function getMaterialGroupPath(
  groups: readonly MaterialGroup[],
  groupId: string,
): string {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const path: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(groupId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return path.join(' / ');
}

export function getMaterialGroupDescendantIds(
  groups: readonly MaterialGroup[],
  groupId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const group of groups) {
    if (!group.parentId) continue;
    const children = childrenByParent.get(group.parentId) ?? [];
    children.push(group.id);
    childrenByParent.set(group.parentId, children);
  }

  const result = new Set<string>([groupId]);
  const stack = [groupId];
  while (stack.length) {
    const current = stack.pop()!;
    for (const childId of childrenByParent.get(current) ?? []) {
      if (result.has(childId)) continue;
      result.add(childId);
      stack.push(childId);
    }
  }
  return result;
}
