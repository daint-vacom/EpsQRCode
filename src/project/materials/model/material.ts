import type {
  MaterialModelImage,
  MaterialModelImageDraft,
  MaterialModelSpecification,
  MaterialPublicDisplaySettings,
} from '@/project/material-models/model/material-model';
import type { SafetyInspectionChecklistGroup } from '@/project/material-safety-inspections/model/safety-inspection-checklist';

export type MaterialCondition = 'good' | 'damaged';
export type MaterialStatus = 'available' | 'loaned';
export type MaterialReservationStatus = 'draft' | 'pending';

/** Immutable metadata copied from the selected model when the material is created. */
export interface MaterialModelSnapshot {
  id: string;
  code: string;
  name: string;
  groupId: string | null;
  description: string;
  requiresInspection: boolean;
  useGroupSafetyInspectionChecklist: boolean;
  specifications: MaterialModelSpecification[];
  safetyInspectionChecklist?: SafetyInspectionChecklistGroup[];
  hiddenSpecificationIds?: string[];
  publicDisplaySettings?: MaterialPublicDisplaySettings;
  images: Omit<MaterialModelImage, 'url'>[];
  capturedAt: string;
}

export type MaterialOwnerKind = 'eps' | 'external' | 'warehouse' | 'other';

export interface MaterialOwnerSnapshot {
  kind: MaterialOwnerKind;
  type: 'department' | 'team' | 'person' | 'external' | 'other' | 'warehouse';
  partyId: string | null;
  catalogPartyId: string | null;
  departmentId: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  teamId: string | null;
  teamCode: string | null;
  teamName: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  sourceType: string | null;
  sourceId: string | null;
  departmentSourceId: string | null;
  teamSourceId: string | null;
  employeeSourceId: string | null;
  externalOrganizationId: string | null;
  warehouseId: string | null;
  scopePartyId: string | null;
  code: string;
  name: string;
  representativeName: string;
  phone: string;
  email: string;
  capturedAt: string;
}

export interface MaterialPublicDetailSpecification {
  id: string;
  name: string;
  dataType: string;
  isList: boolean;
  values: string[];
  valueLabels: string[];
}

export interface MaterialPublicDetail {
  basicInfo: {
    code: string;
    name: string;
    description: string;
    condition: MaterialCondition;
    status: MaterialStatus;
    note: string | null;
    groupName: string | null;
    ownerName: string | null;
    representativeName: string | null;
    images: MaterialImage[];
    lastPrintedLabel: {
      widthMm: number;
      heightMm: number;
      previewSvg: string;
    } | null;
  } | null;
  specifications: MaterialPublicDetailSpecification[] | null;
}

export type MaterialBorrowerSnapshot = Pick<
  MaterialOwnerSnapshot,
  | 'kind'
  | 'type'
  | 'partyId'
  | 'catalogPartyId'
  | 'scopePartyId'
  | 'code'
  | 'name'
  | 'representativeName'
  | 'phone'
  | 'email'
>;

export type MaterialOwnerSnapshotDraft = Pick<
  MaterialOwnerSnapshot,
  'kind' | 'code' | 'name' | 'representativeName' | 'phone' | 'email'
> &
  Partial<
    Pick<
      MaterialOwnerSnapshot,
      | 'departmentId'
      | 'departmentCode'
      | 'departmentName'
      | 'teamId'
      | 'teamCode'
      | 'teamName'
      | 'employeeId'
      | 'scopePartyId'
    >
  >;

export interface Material {
  id: string;
  code: string;
  modelId: string;
  modelSnapshot: MaterialModelSnapshot;
  safetyInspectionChecklist?: SafetyInspectionChecklistGroup[];
  nameOverride: string | null;
  descriptionOverride: string | null;
  images: MaterialImage[];
  specificationOverrides: Record<string, string[]>;
  specificationOverrideLabels: Record<string, string[]>;
  serialNumber: string | null;
  ownerPartyId: string | null;
  ownerSnapshot: MaterialOwnerSnapshot;
  borrowerPartyId: string | null;
  borrowerSnapshot: MaterialBorrowerSnapshot | null;
  condition: MaterialCondition;
  note: string | null;
  status: MaterialStatus;
  isActive: boolean;
  reservedHandoverId: string | null;
  reservationStatus: MaterialReservationStatus | null;
  activeLoanHandoverId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  publicDisplaySettings?: MaterialPublicDisplaySettings;
  publicSpecificationSettings: Record<string, boolean>;
}

export interface MaterialFormValues {
  code: string;
  modelId: string;
  nameOverride: string;
  descriptionOverride: string;
  specificationOverrides: Record<string, string[]>;
  specificationOverrideLabels?: Record<string, string[]>;
  hiddenSpecificationIds?: string[];
  serialNumber: string;
  ownerPartyId: string;
  ownerSnapshot?: MaterialOwnerSnapshotDraft;
  condition: MaterialCondition;
  note: string;
  safetyInspectionChecklist: SafetyInspectionChecklistGroup[];
}

export type SaveMaterialInput = {
  id: string | null;
  expectedVersion: number | null;
  values: MaterialFormValues;
  images: MaterialImageDraft[];
  previousImages: MaterialImage[];
  publicDisplaySettings: MaterialPublicDisplaySettings;
  publicSpecificationSettings: Record<string, boolean>;
};

export interface MaterialImage extends MaterialModelImage {
  storageBucket: string | null;
}

export interface MaterialImageDraft extends MaterialModelImageDraft {
  storageBucket?: string | null;
}

export interface MaterialListFilters {
  id?: string;
  excludeReserved?: boolean;
  allowReservedByHandoverId?: string;
  search?: string;
  modelId?: string;
  groupId?: string;
  ownerPartyId?: string;
  ownerScopePartyId?: string;
  ownerName?: string;
  ownerCatalogId?: string;
  borrowerPartyId?: string;
  borrowerScopePartyId?: string;
  borrowerName?: string;
  receiptId?: string;
  isActive?: boolean;
  status?: MaterialStatus;
  condition?: MaterialCondition;
  page?: number;
  pageSize?: number;
  updatedFrom?: string;
  updatedTo?: string;
}

export interface MaterialListResult {
  items: Material[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MaterialModelSyncPreview {
  materialId: string;
  currentSnapshot: MaterialModelSnapshot;
  proposedSnapshot: MaterialModelSnapshot;
  preservedOverrides: string[];
  changedFields: string[];
  modelUpdatedAt: string;
}

export interface ApplyMaterialModelSyncInput {
  id: string;
  expectedVersion: number;
  expectedModelUpdatedAt: string;
}

export type MaterialHistoryAction =
  | 'created'
  | 'updated'
  | 'model_synced'
  | 'handover';
export interface MaterialHistoryEntry {
  id: string;
  materialId: string;
  actorUserId: string;
  actorDisplayName: string | null;
  action: MaterialHistoryAction;
  note: string | null;
  fromState: Record<string, unknown> | null;
  toState: Record<string, unknown>;
  createdAt: string;
}
