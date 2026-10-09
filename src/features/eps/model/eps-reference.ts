export interface EpsDepartment {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  viewName: string | null;
  type: number;
  areaId: string | null;
  employeeCount: number;
}

export interface EpsTeam {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  viewName: string | null;
  description: string | null;
  type: number;
  employeeCount: number;
  department?: Pick<EpsDepartment, 'id' | 'code' | 'name'>;
}

export interface EpsPosition {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  viewName: string | null;
  description: string | null;
  level: number;
  type: number | null;
}

export interface EpsArea {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  viewName: string | null;
  description: string | null;
}

export interface EpsEmployeeReference {
  id: string;
  code: string;
  fullName: string;
  imageUrl: string | null;
  team: Partial<EpsTeam>;
  position: Partial<EpsPosition>;
  area: Partial<EpsArea>;
}

export interface EpsCurrentEmployee {
  userId: string;
  fullName: string;
  email: string | null;
}

export interface EpsEmployeeSearchParams {
  page?: number;
  limit?: number;
  departmentIds?: string[];
  roles?: string[];
  active?: boolean;
  isExpert?: boolean;
}

export interface EpsEmployeePageMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

export interface EpsEmployeePage {
  items: EpsEmployeeReference[];
  meta: EpsEmployeePageMeta;
}
