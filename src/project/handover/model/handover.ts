import type { MaterialCondition } from '@/project/materials/model/material';

export type HandoverType = 'transfer' | 'loan' | 'return';
export type HandoverStatus =
  | 'draft'
  | 'awaiting_warehouse_approval'
  | 'pending'
  | 'completed'
  | 'rejected'
  | 'cancelled';
export type HandoverMode =
  'standard' | 'warehouse_allocation' | 'warehouse_request';
export type HandoverPartyKind = 'eps' | 'external' | 'warehouse' | 'other';

export interface HandoverPartySnapshot {
  id: string | null;
  code: string;
  name: string;
  type: 'department' | 'team' | 'person' | 'external' | 'other' | 'warehouse';
  isHandoverCustom?: boolean;
  phone?: string | null;
  email?: string | null;
  representativeName?: string | null;
  handoverScopePartyId?: string | null;
  scopePartyId?: string | null;
  externalOrganizationId?: string | null;
  warehouseId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  departmentId?: string | null;
  departmentSourceId?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  teamId?: string | null;
  teamSourceId?: string | null;
  teamCode?: string | null;
  teamName?: string | null;
  employeeId?: string | null;
  employeeSourceId?: string | null;
  employeeCode?: string | null;
  employeeName?: string | null;
  catalogPartyId?: string | null;
  canRepresent?: boolean;
}

export interface HandoverRepresentativeSnapshot {
  userId: string | null;
  displayName: string;
}

export interface HandoverItem {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  modelCode: string;
  modelName: string;
  serialNumber: string | null;
  condition: MaterialCondition;
  note: string | null;
  senderCondition: MaterialCondition;
  receiverOutcome: 'pending' | 'received' | 'not_received';
}

export interface HandoverAttachment {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface HandoverDocument {
  id: string;
  code: string;
  type: HandoverType;
  status: HandoverStatus;
  mode: HandoverMode;
  receiptId: string | null;
  senderParty: HandoverPartySnapshot;
  recipientParty: HandoverPartySnapshot;
  senderRepresentative: HandoverRepresentativeSnapshot | null;
  recipientRepresentative: HandoverRepresentativeSnapshot | null;
  recipientHasQrAccount: boolean;
  senderCanRepresent?: boolean;
  recipientCanRepresent?: boolean;
  reversesHandoverId?: string | null;
  plannedDate: string | null;
  dueDate: string | null;
  note: string | null;
  items: HandoverItem[];
  attachments: HandoverAttachment[];
  version: number;
  createdBy: string;
  confirmedBy: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface HandoverItemInput {
  materialId: string;
  condition: MaterialCondition;
  note: string;
}

export interface WarehouseHandoverSaveInput {
  id: string | null;
  values: {
    mode: Exclude<HandoverMode, 'standard'>;
    warehouseId: string;
    recipientPartyId: string;
    receiptId: string | null;
    plannedDate: string;
    note: string;
    items: HandoverItemInput[];
    expectedVersion?: number;
  };
}

export interface HandoverFormValues {
  type: HandoverType;
  senderPartyId: string;
  recipientPartyId: string;
  senderPartyKind: HandoverPartyKind;
  recipientPartyKind: HandoverPartyKind;
  senderPartyCode: string;
  recipientPartyCode: string;
  senderPartyName: string;
  recipientPartyName: string;
  senderPartyPhone: string;
  recipientPartyPhone: string;
  senderPartyEmail: string;
  recipientPartyEmail: string;
  senderRepresentativeName: string;
  recipientRepresentativeName: string;
  senderPartyScopePartyId: string;
  recipientPartyScopePartyId: string;
  senderRepresentativeUserId: string | null;
  recipientRepresentativeUserId: string | null;
  plannedDate: string;
  dueDate: string;
  note: string;
  items: HandoverItemInput[];
  attachmentFileIds: string[];
  expectedVersion?: number;
  reverseFromHandoverId?: string | null;
}

export type HandoverAction = 'send' | 'confirm' | 'reject' | 'cancel';
export interface HandoverActionInput {
  id: string;
  action: HandoverAction;
  expectedVersion: number;
  note?: string;
  itemConditions?: HandoverItemInput[];
}

export interface HandoverHistoryEntry {
  id: string;
  handoverId: string;
  actorUserId: string;
  actorDisplayName: string | null;
  action:
    | 'created'
    | 'updated'
    | 'sent'
    | 'warehouse_approved'
    | 'confirmed'
    | 'confirmed_offline'
    | 'rejected'
    | 'cancelled';
  note: string | null;
  fromStatus: HandoverStatus | null;
  toStatus: HandoverStatus;
  createdAt: string;
}

export interface HandoverListFilters {
  search?: string;
  type?: HandoverType;
  status?: HandoverStatus;
  page?: number;
  pageSize?: number;
  senderPartyId?: string;
  recipientPartyId?: string;
  materialId?: string;
  receiptId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface HandoverListResult {
  items: HandoverDocument[];
  total: number;
  page: number;
  pageSize: number;
}
