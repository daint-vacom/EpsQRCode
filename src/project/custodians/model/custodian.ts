export type CustodianType = 'department' | 'team' | 'person' | 'external';

export interface Custodian {
  id: string;
  type: CustodianType;
  code: string;
  name: string;
  parentId: string | null;
  accountUserId: string | null;
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
