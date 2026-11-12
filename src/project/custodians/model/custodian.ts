export type CustodianType =
  | 'department'
  | 'team'
  | 'person'
  | 'external'
  | 'other';
export type CustodianPartyType = CustodianType | 'warehouse';
export type EpsCustodianSourceType =
  | 'eps_department'
  | 'eps_team'
  | 'eps_person';

export interface Custodian {
  id: string;
  type: CustodianPartyType;
  code: string;
  name: string;
  parentId: string | null;
  sourceType: EpsCustodianSourceType | null;
  sourceId: string | null;
  canRepresent: boolean;
  canManageMaterial?: boolean;
  canManageHandover?: boolean;
  accountUserId: string | null;
  accountUserIds: string[];
  representativeUserId: string | null;
  representativeDisplayName: string | null;
  representativeName?: string | null;
  phone?: string | null;
  email?: string | null;
  isHandoverCustom?: boolean;
  handoverScopePartyId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** EPS employee catalog entry used by owner and handover selectors. */
export interface EpsEmployeeCatalogEntry {
  id: string;
  sourceId: string;
  code: string;
  name: string;
  departmentId: string;
  departmentName: string;
  teamId: string | null;
  teamName: string | null;
}

export interface EpsEmployeeListFilters {
  search?: string;
  departmentId?: string;
  teamId?: string;
  accessMode?: 'view' | 'manage';
  page?: number;
  pageSize?: number;
}

export interface EpsEmployeeListResult {
  items: EpsEmployeeCatalogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export type HandoverCustomParty = Pick<
  Custodian,
  | 'id'
  | 'type'
  | 'code'
  | 'name'
  | 'parentId'
  | 'canRepresent'
  | 'isActive'
  | 'phone'
  | 'email'
  | 'isHandoverCustom'
  | 'representativeName'
  | 'handoverScopePartyId'
>;

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
  parentId?: string | null;
  phone?: string | null;
  email?: string | null;
  representativeName?: string | null;
}
