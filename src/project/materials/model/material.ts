import type {
  MaterialModelImage,
  MaterialModelImageDraft,
  MaterialModelSpecification,
} from '@/project/material-models/model/material-model';

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
  specifications: MaterialModelSpecification[];
  images: Omit<MaterialModelImage, 'url'>[];
  capturedAt: string;
}

export interface Material {
  id: string;
  code: string;
  modelId: string;
  modelSnapshot: MaterialModelSnapshot;
  nameOverride: string | null;
  descriptionOverride: string | null;
  images: MaterialImage[];
  specificationOverrides: Record<string, string[]>;
  specificationOverrideLabels: Record<string, string[]>;
  serialNumber: string | null;
  ownerPartyId: string;
  borrowerPartyId: string | null;
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
}

export interface MaterialFormValues {
  code: string;
  modelId: string;
  nameOverride: string;
  descriptionOverride: string;
  specificationOverrides: Record<string, string[]>;
  specificationOverrideLabels?: Record<string, string[]>;
  serialNumber: string;
  ownerPartyId: string;
  condition: MaterialCondition;
  note: string;
}

export type SaveMaterialInput = {
  id: string | null;
  expectedVersion: number | null;
  values: MaterialFormValues;
  images: MaterialImageDraft[];
  previousImages: MaterialImage[];
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
  borrowerPartyId?: string;
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
  'created' | 'updated' | 'model_synced' | 'handover';
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
