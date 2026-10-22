export type CustodianType = 'department' | 'team' | 'person' | 'external';
export type CustodianPartyType = CustodianType | 'warehouse';
export type EpsCustodianSourceType =
  'eps_department' | 'eps_team' | 'eps_person';

export interface Custodian {
  id: string;
  type: CustodianPartyType;
  code: string;
  name: string;
  parentId: string | null;
  sourceType: EpsCustodianSourceType | null;
  sourceId: string | null;
  canRepresent: boolean;
  accountUserId: string | null;
  accountUserIds: string[];
  representativeUserId: string | null;
  representativeDisplayName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustodianFormValues {
  sourceKey: string;
  representativeUserId: string;
}

export type SaveCustodianValues = Omit<
  CustodianFormValues,
  'sourceKey' | 'representativeUserId'
> & {
  sourceId: string;
  type: Exclude<CustodianType, 'external'>;
  representativeUserId: string | null;
};

export interface FakeEpsParty {
  source_type: EpsCustodianSourceType;
  source_id: string;
  code: string;
  name: string;
  parent_source_id: string | null;
  is_active: boolean;
}

export interface HandoverCounterpartyOption {
  id: string;
  type: CustodianPartyType;
  code: string;
  name: string;
}
