import type {
  EpsArea,
  EpsCurrentEmployee,
  EpsDepartment,
  EpsEmployeePage,
  EpsEmployeeSearchParams,
  EpsPosition,
  EpsTeam,
} from '../model/eps-reference';
import { epsApi } from './eps-api-client';

interface EpsApiResponse<T> {
  returnData: T;
}

interface EpsCurrentUserDto {
  id?: string;
  userId?: string | null;
  employeeId?: string | null;
  fullName?: string;
  email?: string | null;
  user?: {
    id?: string;
    email?: string | null;
  };
  employee?: {
    id?: string;
    fullName?: string;
    email?: string | null;
  };
}

export async function getEpsDepartments(
  signal?: AbortSignal,
): Promise<EpsDepartment[]> {
  const response = await epsApi.get<EpsApiResponse<EpsDepartment[]>>(
    '/eps/departments',
    { signal },
  );
  return response.returnData;
}

export async function getEpsTeams(
  departmentId?: string,
  signal?: AbortSignal,
): Promise<EpsTeam[]> {
  const response = await epsApi.get<EpsApiResponse<EpsTeam[]>>('/eps/teams', {
    params: departmentId ? { departmentId } : undefined,
    signal,
  });
  return response.returnData;
}

export async function getEpsTeamsByDepartment(
  departmentCode: string,
  signal?: AbortSignal,
): Promise<EpsTeam[]> {
  const response = await epsApi.get<EpsApiResponse<EpsTeam[]>>(
    `/eps/departments/${encodeURIComponent(departmentCode)}/teams`,
    { signal },
  );
  return response.returnData;
}

export async function getEpsPositions(
  signal?: AbortSignal,
): Promise<EpsPosition[]> {
  const response = await epsApi.get<EpsApiResponse<EpsPosition[]>>(
    '/eps/positions',
    { signal },
  );
  return response.returnData;
}

export async function getEpsAreas(signal?: AbortSignal): Promise<EpsArea[]> {
  const response = await epsApi.get<EpsApiResponse<EpsArea[]>>('/eps/areas', {
    signal,
  });
  return response.returnData;
}

export async function searchEpsEmployees(
  params: EpsEmployeeSearchParams,
  signal?: AbortSignal,
): Promise<EpsEmployeePage> {
  const response = await epsApi.post<EpsApiResponse<EpsEmployeePage>>(
    '/eps/employees/search',
    params,
    { signal },
  );
  return response.returnData;
}

export async function getEpsCurrentEmployee(
  signal?: AbortSignal,
): Promise<EpsCurrentEmployee> {
  const response = await epsApi.get<EpsApiResponse<EpsCurrentUserDto>>(
    '/employees/current-user/',
    { signal },
  );
  const currentUser = response.returnData;
  if (!currentUser) {
    throw new Error('EPS không trả về thông tin người dùng hiện tại.');
  }

  const employee = currentUser.employee ?? currentUser;
  const user = currentUser.user ?? currentUser;

  return {
    userId: currentUser.id ?? currentUser.userId ?? user.id ?? '',
    fullName: employee.fullName ?? '',
    email:
      employee.email ?? currentUser.user?.email ?? currentUser.email ?? null,
  };
}
