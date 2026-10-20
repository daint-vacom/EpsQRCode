import type { MaterialCondition } from '@/project/materials/model/material';

export type HandoverType = 'transfer' | 'loan' | 'return';
export type HandoverStatus =
  'draft' | 'pending' | 'completed' | 'rejected' | 'cancelled';

export interface HandoverPartySnapshot {
  id: string;
  code: string;
  name: string;
  type: 'department' | 'team' | 'person' | 'external';
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
  senderParty: HandoverPartySnapshot;
  recipientParty: HandoverPartySnapshot;
  senderRepresentative: HandoverRepresentativeSnapshot | null;
  recipientRepresentative: HandoverRepresentativeSnapshot | null;
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

export interface HandoverFormValues {
  type: HandoverType;
  senderPartyId: string;
  recipientPartyId: string;
  senderRepresentativeUserId: string | null;
  recipientRepresentativeUserId: string | null;
  plannedDate: string;
  dueDate: string;
  note: string;
  items: HandoverItemInput[];
  attachmentFileIds: string[];
  expectedVersion?: number;
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
    'created' | 'updated' | 'sent' | 'confirmed' | 'rejected' | 'cancelled';
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
  dateFrom?: string;
  dateTo?: string;
}

export interface HandoverListResult {
  items: HandoverDocument[];
  total: number;
  page: number;
  pageSize: number;
}
