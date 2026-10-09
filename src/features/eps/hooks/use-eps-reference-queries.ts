import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getEpsAreas,
  getEpsCurrentEmployee,
  getEpsDepartments,
  getEpsPositions,
  getEpsTeams,
  getEpsTeamsByDepartment,
  searchEpsEmployees,
} from '../api/eps-reference.api';
import type { EpsEmployeeSearchParams } from '../model/eps-reference';

export const epsReferenceKeys = {
  all: ['eps'] as const,
  departments: () => [...epsReferenceKeys.all, 'departments'] as const,
  teams: (departmentId?: string) =>
    [...epsReferenceKeys.all, 'teams', departmentId ?? 'all'] as const,
  teamsByDepartmentCode: (departmentCode: string) =>
    [
      ...epsReferenceKeys.all,
      'teams-by-department-code',
      departmentCode,
    ] as const,
  positions: () => [...epsReferenceKeys.all, 'positions'] as const,
  areas: () => [...epsReferenceKeys.all, 'areas'] as const,
  employees: () => [...epsReferenceKeys.all, 'employees'] as const,
  currentEmployee: () => [...epsReferenceKeys.employees(), 'current'] as const,
  employeeSearch: (params: EpsEmployeeSearchParams) =>
    [...epsReferenceKeys.employees(), 'search', params] as const,
};

export function useEpsDepartmentsQuery(enabled = true) {
  return useQuery({
    queryKey: epsReferenceKeys.departments(),
    queryFn: ({ signal }) => getEpsDepartments(signal),
    enabled,
    retry: 0,
  });
}

export function useEpsTeamsQuery(departmentId?: string, enabled = true) {
  return useQuery({
    queryKey: epsReferenceKeys.teams(departmentId),
    queryFn: ({ signal }) => getEpsTeams(departmentId, signal),
    enabled,
    retry: 0,
  });
}

export function useEpsTeamsByDepartmentQuery(
  departmentCode: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: epsReferenceKeys.teamsByDepartmentCode(departmentCode ?? ''),
    queryFn: ({ signal }) => {
      if (!departmentCode) throw new Error('Thiếu mã phòng ban.');
      return getEpsTeamsByDepartment(departmentCode, signal);
    },
    enabled: Boolean(departmentCode) && enabled,
    retry: 0,
  });
}

export function useEpsPositionsQuery(enabled = true) {
  return useQuery({
    queryKey: epsReferenceKeys.positions(),
    queryFn: ({ signal }) => getEpsPositions(signal),
    enabled,
    retry: 0,
  });
}

export function useEpsAreasQuery(enabled = true) {
  return useQuery({
    queryKey: epsReferenceKeys.areas(),
    queryFn: ({ signal }) => getEpsAreas(signal),
    enabled,
    retry: 0,
  });
}

export function useEpsCurrentEmployeeQuery(enabled = true) {
  return useQuery({
    queryKey: epsReferenceKeys.currentEmployee(),
    queryFn: ({ signal }) => getEpsCurrentEmployee(signal),
    enabled,
    retry: 0,
  });
}

export function useEpsEmployeeSearchQuery(
  params: EpsEmployeeSearchParams,
  enabled = true,
) {
  const stableParams = {
    ...params,
    departmentIds: params.departmentIds
      ? [...params.departmentIds].sort()
      : undefined,
    roles: params.roles ? [...params.roles].sort() : undefined,
  };

  return useQuery({
    queryKey: epsReferenceKeys.employeeSearch(stableParams),
    queryFn: ({ signal }) => searchEpsEmployees(stableParams, signal),
    enabled,
    retry: 0,
  });
}

export function useEpsEmployeeListQuery({
  departmentId,
  roles = [],
  additionalQueryKey = [],
  active = true,
  enabled = true,
}: {
  departmentId?: string;
  roles?: string[];
  additionalQueryKey?: string[];
  active?: boolean | null;
  enabled?: boolean;
} = {}) {
  const params: EpsEmployeeSearchParams = {
    departmentIds: departmentId ? [departmentId] : undefined,
    roles,
    active: active === null ? undefined : active,
  };

  return useQuery({
    queryKey: [
      ...epsReferenceKeys.employeeSearch(params),
      ...additionalQueryKey,
    ],
    queryFn: async ({ signal }) =>
      (await searchEpsEmployees(params, signal)).items,
    enabled,
    retry: 0,
  });
}

export function useEpsDepartmentsWithTeams(enabled = true) {
  const departmentsQuery = useEpsDepartmentsQuery(enabled);
  const teamsQuery = useEpsTeamsQuery(undefined, enabled);

  const data = useMemo(() => {
    if (!departmentsQuery.data || !teamsQuery.data) return undefined;
    return departmentsQuery.data.map((department) => ({
      ...department,
      teams: teamsQuery.data.filter(
        (team) => team.department?.id === department.id,
      ),
    }));
  }, [departmentsQuery.data, teamsQuery.data]);

  return {
    data,
    isPending: departmentsQuery.isPending || teamsQuery.isPending,
    isError: departmentsQuery.isError || teamsQuery.isError,
    error: departmentsQuery.error ?? teamsQuery.error,
    refetch: async () =>
      Promise.all([departmentsQuery.refetch(), teamsQuery.refetch()]),
  };
}
