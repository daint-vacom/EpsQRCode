export type CustodianType = 'department' | 'team' | 'person' | 'external';
export type CustodianPartyType = CustodianType | 'warehouse';

export interface Custodian {
  id: string;
  type: CustodianPartyType;
  code: string;
  name: string;
  parentId: string | null;
  accountUserId: string | null;
  accountUserIds: string[];
  representativeUserId: string | null;
  representativeDisplayName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustodianFormValues {
  type: CustodianType;
  code: string;
  name: string;
  parentId: string | null;
  accountUserId: string | null;
  representativeUserId: string | null;
  isActive: boolean;
}
