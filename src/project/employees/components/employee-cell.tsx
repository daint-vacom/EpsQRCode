import { buildPath, ROUTES } from '@/constants/routes';
import { Link } from 'react-router-dom';
import type { Employee } from '../model/employee';
import { EmployeeIdentity } from './employee-identity';

export function EmployeeCell({ employee }: { employee: Employee }) {
  return (
    <Link
      to={buildPath(ROUTES.PROJECT.EMPLOYEE_DETAIL, { id: employee.id })}
      className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Xem chi tiết nhân viên ${employee.displayName}`}
    >
      <EmployeeIdentity employee={employee} />
    </Link>
  );
}
