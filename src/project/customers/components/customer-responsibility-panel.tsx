import { useState } from 'react';
import { Pencil, Plus, Users } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tag } from '@/components/ui/tag';
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
            <CardDescription>
              Vai trò nghiệp vụ của từng nhân viên đối với khách hàng này.
            </CardDescription>
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
        <CardContent>
          {workspaceQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : workspaceQuery.isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {getApiErrorMessage(workspaceQuery.error)}
            </div>
          ) : workspace?.assignments.length ? (
            <div className="divide-y divide-border rounded-lg border">
              {workspace.assignments.map((assignment) => {
                const employee = employeeById.get(assignment.employeeId);
                if (!employee) return null;

                return (
                  <div
                    key={assignment.employeeId}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Users className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {employee.displayName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[employee.employeeCode, employee.jobTitle]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:justify-end">
                      {assignment.responsibilityRoleIds.map((roleId) => {
                        const role = roleById.get(roleId);
                        return role ? (
                          <Tag
                            key={role.id}
                            size="sm"
                            shape="circle"
                            className={cn(
                              employee.status === 'inactive' && 'opacity-60',
                            )}
                          >
                            {role.name}
                          </Tag>
                        ) : null;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Users className="size-5" />
              </span>
              <div>
                <p className="font-medium">Chưa có nhân viên phụ trách</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Phân công nhân viên và vai trò nghiệp vụ cho khách hàng này.
                </p>
              </div>
            </div>
          )}
        </CardContent>
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
