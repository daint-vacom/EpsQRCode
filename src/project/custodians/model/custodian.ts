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

export interface RepresentativeAccount {
  id: string;
  username: string | null;
  displayName: string;
}

export type EpsOrganizationType = 'department' | 'team';

export interface EpsOrganization {
  id: string;
  sourceId: string;
  type: EpsOrganizationType;
  code: string;
  name: string;
  parentName: string | null;
  canManageRepresentatives: boolean;
  representativeUserIds: string[];
  representativeAccounts: RepresentativeAccount[];
  representativeOptions: RepresentativeAccount[];
}

export interface HandoverCounterpartyOption {
  id: string;
  type: CustodianPartyType;
  code: string;
  name: string;
}
