import { useQuery } from '@tanstack/react-query';
import {
  loadSubjectTagFilter,
  type TaggableSubjectType,
  type TagSelectConfig,
} from '../api/tags.api';

export function useSubjectTagFilter(
  subjectType: TaggableSubjectType,
  config: TagSelectConfig,
) {
  const moduleCodes = config.moduleCodes ?? [];
  const allowCustomGroups = config.allowCustomGroups ?? true;
  const enabled = config.enabled ?? true;

  return useQuery({
    queryKey: [
      'project',
      'tags',
      'subject-filter',
      subjectType,
      moduleCodes,
      allowCustomGroups,
    ],
    queryFn: () =>
      loadSubjectTagFilter(subjectType, {
        moduleCodes,
        allowCustomGroups,
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
