import { useState } from 'react';
import { EmployeeRoleBadge } from '@/project/employees/components/employee-badges';
import { EmployeeCell } from '@/project/employees/components/employee-cell';
import { Pencil, Plus } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardHeading,
  CardTable,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCustomerResponsibilityWorkspace } from '../hooks/use-customer-responsibility-workspace';
import type { Customer } from '../model/customer';
import { CustomerResponsibilityDialog } from './customer-responsibility-dialog';

export function CustomerResponsibilityPanel({
  customer,
  canManage,
}: {
  customer: Customer;
  canManage: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { workspaceQuery } = useCustomerResponsibilityWorkspace({
    tenantId: customer.tenantId,
    customerId: customer.id,
    enabled: true,
  });
  const workspace = workspaceQuery.data;
  const employeeById = new Map(
    (workspace?.employees ?? []).map((employee) => [employee.id, employee]),
  );
  const roleById = new Map(
    (workspace?.roles ?? []).map((role) => [role.id, role]),
  );

  return (
    <>
      <Card>
        <CardHeader className="flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <CardHeading>
            <CardTitle>Nhân viên phụ trách</CardTitle>
          </CardHeading>
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(true)}
            >
              {workspace?.assignments.length ? <Pencil /> : <Plus />}
              {workspace?.assignments.length
                ? 'Chỉnh sửa phân công'
                : 'Phân công nhân viên'}
            </Button>
          ) : null}
        </CardHeader>
        <CardTable className="min-h-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Nhân viên</TableHead>
                <TableHead className="min-w-[200px]">
                  Phụ trách vai trò
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspaceQuery.isLoading ? (
                <TableRow>
                  <TableCell>
                    <Skeleton className="h-10 w-56" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-7 w-36" />
                  </TableCell>
                </TableRow>
              ) : workspaceQuery.isError ? (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="h-28 text-center text-sm text-destructive"
                  >
                    {getApiErrorMessage(workspaceQuery.error)}
                  </TableCell>
                </TableRow>
              ) : workspace?.assignments.length ? (
                workspace.assignments.map((assignment) => {
                  const employee = employeeById.get(assignment.employeeId);
                  if (!employee) return null;

                  const roles = assignment.responsibilityRoleIds
                    .map((roleId) => roleById.get(roleId))
                    .filter((role): role is NonNullable<typeof role> =>
                      Boolean(role),
                    );

                  return (
                    <TableRow key={assignment.employeeId}>
                      <TableCell>
                        <EmployeeCell employee={employee} />
                      </TableCell>
                      <TableCell>
                        {roles.length ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {roles.map((role) => (
                              <EmployeeRoleBadge
                                key={role.id}
                                role={{ name: role.name, color: 'blue' }}
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Chưa gán vai trò
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="h-28 text-center text-sm text-muted-foreground"
                  >
                    Chưa có nhân viên phụ trách
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardTable>
      </Card>
      {canManage ? (
        <CustomerResponsibilityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          tenantId={customer.tenantId}
          customerId={customer.id}
          customerName={customer.name}
        />
      ) : null}
    </>
  );
}
