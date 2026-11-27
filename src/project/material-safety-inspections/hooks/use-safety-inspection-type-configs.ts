import { materialDashboardKeys } from '@/project/dashboard/hooks/use-material-dashboard';
import { materialModelKeys } from '@/project/material-models/hooks/use-material-models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadSafetyInspectionTypeConfigs,
  previewSafetyInspectionTypeSchedule,
  saveSafetyInspectionTypeConfig,
} from '../api/safety-inspection-type-configs.api';
import type {
  SafetyInspectionConfigScope,
  SafetyInspectionIntervalUnit,
  SaveSafetyInspectionTypeConfigInput,
} from '../model/safety-inspection-type-config';
import { safetyInspectionKeys } from './use-safety-inspections';

export const safetyInspectionTypeConfigKeys = {
  all: [...safetyInspectionKeys.all, 'type-configs'] as const,
  scope: (scopeKind: SafetyInspectionConfigScope, scopeId: string) =>
    [...safetyInspectionTypeConfigKeys.all, scopeKind, scopeId] as const,
};

export function useSafetyInspectionTypeConfigsQuery(
  scopeKind: SafetyInspectionConfigScope,
  scopeId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: safetyInspectionTypeConfigKeys.scope(scopeKind, scopeId),
    queryFn: ({ signal }) =>
      loadSafetyInspectionTypeConfigs(scopeKind, scopeId, signal),
    enabled: Boolean(scopeId) && enabled,
    retry: 0,
  });
}

export function useSaveSafetyInspectionTypeConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveSafetyInspectionTypeConfigInput) =>
      saveSafetyInspectionTypeConfig(input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: safetyInspectionTypeConfigKeys.all,
        }),
        queryClient.invalidateQueries({ queryKey: safetyInspectionKeys.all }),
        queryClient.invalidateQueries({ queryKey: materialDashboardKeys.all }),
        queryClient.invalidateQueries({ queryKey: materialModelKeys.all }),
      ]),
  });
}

export function useSafetyInspectionSchedulePreviewQuery(
  scopeKind: SafetyInspectionConfigScope,
  scopeId: string,
  typeId: string | null,
  intervalValue: number | null,
  intervalUnit: SafetyInspectionIntervalUnit | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [
      ...safetyInspectionTypeConfigKeys.all,
      'schedule-preview',
      scopeKind,
      scopeId,
      typeId,
      intervalValue,
      intervalUnit,
    ] as const,
    queryFn: ({ signal }) => {
      if (!typeId || intervalValue == null || !intervalUnit) {
        throw new Error('Schedule preview parameters are incomplete');
      }
      return previewSafetyInspectionTypeSchedule(
        scopeKind,
        scopeId,
        typeId,
        intervalValue,
        intervalUnit,
        signal,
      );
    },
    enabled: Boolean(
      enabled && scopeId && typeId && intervalValue && intervalUnit,
    ),
    retry: 0,
  });
}
