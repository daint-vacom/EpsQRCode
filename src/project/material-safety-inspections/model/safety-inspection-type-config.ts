import type { SafetyInspectionChecklistGroup } from './safety-inspection-checklist';

export type SafetyInspectionConfigScope = 'group' | 'model' | 'material';
export type SafetyInspectionIntervalUnit = 'day' | 'month' | 'quarter';

export interface SafetyInspectionTypeConfigOverride {
  nameOverride: string | null;
  checklist: SafetyInspectionChecklistGroup[] | null;
  checklistMode: 'replace' | 'append';
  intervalValue: number | null;
  intervalUnit: SafetyInspectionIntervalUnit | null;
  enabled: boolean | null;
  startsOn: string | null;
}

export interface SafetyInspectionTypeConfigView {
  typeId: string;
  typeName: string;
  checklist: SafetyInspectionChecklistGroup[] | null;
  intervalValue: number | null;
  intervalUnit: SafetyInspectionIntervalUnit | null;
  enabled: boolean;
  startsOn: string | null;
  sourceKind: SafetyInspectionConfigScope;
  sourceId: string;
  hasParent: boolean;
  directConfig: SafetyInspectionTypeConfigOverride | null;
}

export interface SaveSafetyInspectionTypeConfigInput {
  scopeKind: SafetyInspectionConfigScope;
  scopeId: string;
  typeId: string;
  name: string | null;
  checklist: SafetyInspectionChecklistGroup[] | null;
  checklistMode: 'replace' | 'append';
  intervalValue: number | null;
  intervalUnit: SafetyInspectionIntervalUnit | null;
  enabled: boolean | null;
  startsOn: string | null;
  recalculate: boolean;
  expectedPreviewToken: string | null;
}

export interface SafetyInspectionSchedulePreviewItem {
  materialId: string;
  code: string;
  name: string;
  anchorDate: string;
  lastCompletedAt: string | null;
  oldDueDate: string | null;
  newDueDate: string;
}

export interface SafetyInspectionSchedulePreview {
  token: string;
  total: number;
  items: SafetyInspectionSchedulePreviewItem[];
}
