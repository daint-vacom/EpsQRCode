import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CustomerIdentity } from '@/project/customers/components/customer-identity';
import {
  CustomerTable,
  type CustomerTableController,
} from '@/project/customers/components/customer-table';
import { CUSTOMER_LIST_INITIAL_FILTERS } from '@/project/customers/model/customer';
import { useCustomerColumns } from '@/project/customers/table/customer.columns.generated';
import { CustomerFilterBar } from '@/project/customers/table/customer.filters.generated';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnVisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { Info, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataGridColumnVisibility } from '@/components/ui/data-grid-column-visibility';
import {
  MultiSelect,
  type MultiSelectOption,
} from '@/components/ui/multi-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { EmployeeRoleOption } from '../model/employee';
import type {
  EmployeeCustomerAssignmentInput,
  EmployeeCustomerOption,
} from '../model/employee-responsibility';
import { EmployeeRoleBadge } from './employee-badges';

export interface EmployeeResponsibilityEditorProps {
  roleOptions: EmployeeRoleOption[];
  employeeRoleIds: string[];
  customers: EmployeeCustomerOption[];
  customerTable?: CustomerTableController;
  assignments: EmployeeCustomerAssignmentInput[];
  onAssignmentsChange: (assignments: EmployeeCustomerAssignmentInput[]) => void;
  canManage: boolean;
  employeeHasLinkedAccount: boolean;
  isLoading?: boolean;
  error?: unknown;
}

const EMPTY_CUSTOMER_TABLE: CustomerTableController = {
  customers: [],
  total: 0,
  keyword: '',
  setKeyword: () => undefined,
  filters: CUSTOMER_LIST_INITIAL_FILTERS,
  setFilter: () => undefined,
  pagination: { pageIndex: 0, pageSize: 10 },
  onPaginationChange: () => undefined,
  customFields: [],
  tagsByCustomerId: {},
  isLoading: false,
  isFetching: false,
};

const CUSTOMER_SELECTION_COLUMN_PINNING = {
  left: ['select', 'name'],
  right: [],
};

const CUSTOMER_SELECTION_HIDDEN_COLUMNS = [
  'contact',
  'status',
  'businessRegistrationCode',
  'countryCode',
  'phone',
  'email',
  'address',
  'note',
] as const;

function getCustomerSelectionColumnVisibility(
  customFields: CustomerTableController['customFields'],
): ColumnVisibilityState {
  return {
    ...Object.fromEntries(
      CUSTOMER_SELECTION_HIDDEN_COLUMNS.map((columnId) => [columnId, false]),
    ),
    ...Object.fromEntries(
      customFields
        .filter((field) => field.isActive)
        .map((field) => [`customField:${field.key}`, false]),
    ),
  };
}

export function EmployeeCustomerSelectionStep({
  customerTable,
  assignments,
  onAssignmentsChange,
  canManage,
  employeeHasLinkedAccount,
  isLoading = false,
  error,
}: EmployeeResponsibilityEditorProps) {
  const tableState = customerTable ?? EMPTY_CUSTOMER_TABLE;
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>(() =>
      getCustomerSelectionColumnVisibility(tableState.customFields),
    );
  useEffect(() => {
    if (tableState.customFields.length === 0) return;

    setColumnVisibility((current) => {
      const next = { ...current };
      let changed = false;
      for (const field of tableState.customFields) {
        if (!field.isActive) continue;
        const columnId = `customField:${field.key}`;
        if (columnId in next) continue;
        next[columnId] = false;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [tableState.customFields]);

  const columns = useCustomerColumns({
    includeActions: false,
    customFields: tableState.customFields,
    tagIds: tableState.filters.tagIds,
    onTagIdsChange: (value) => tableState.setFilter('tagIds', value),
    tagsByCustomerId: tableState.tagsByCustomerId,
    name: tableState.filters.name,
    onNameChange: (value) => tableState.setFilter('name', value),
    businessTypes: tableState.filters.businessTypes,
    onBusinessTypesChange: (value) =>
      tableState.setFilter(
        'businessTypes',
        value as typeof tableState.filters.businessTypes,
      ),
    businessRegistrationCode: tableState.filters.businessRegistrationCode,
    onBusinessRegistrationCodeChange: (value) =>
      tableState.setFilter('businessRegistrationCode', value),
    countryCode: tableState.filters.countryCode,
    onCountryCodeChange: (value) => tableState.setFilter('countryCode', value),
    region: tableState.filters.region,
    onRegionChange: (value) => tableState.setFilter('region', value),
    contactSearch: tableState.filters.contactSearch,
    onContactSearchChange: (value) =>
      tableState.setFilter('contactSearch', value),
    phone: tableState.filters.phone,
    onPhoneChange: (value) => tableState.setFilter('phone', value),
    email: tableState.filters.email,
    onEmailChange: (value) => tableState.setFilter('email', value),
    address: tableState.filters.address,
    onAddressChange: (value) => tableState.setFilter('address', value),
    statuses: tableState.filters.statuses,
    onStatusesChange: (value) =>
      tableState.setFilter(
        'statuses',
        value as typeof tableState.filters.statuses,
      ),
    note: tableState.filters.note,
    onNoteChange: (value) => tableState.setFilter('note', value),
    customFieldValues: tableState.filters.customFields,
    onCustomFieldChange: (key, value) =>
      tableState.setFilter('customFields', {
        ...tableState.filters.customFields,
        [key]: value,
      }),
  });

  const rowSelection = useMemo<RowSelectionState>(
    () =>
      Object.fromEntries(
        assignments.map((assignment) => [assignment.customerId, true]),
      ),
    [assignments],
  );

  const table = useReactTable({
    data: tableState.customers,
    columns,
    getRowId: (row) => row.id,
    state: {
      pagination: tableState.pagination,
      rowSelection,
      columnVisibility,
      columnPinning: CUSTOMER_SELECTION_COLUMN_PINNING,
    },
    onPaginationChange: tableState.onPaginationChange,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const nextSelection =
        typeof updater === 'function' ? updater(rowSelection) : updater;
      const assignmentByCustomerId = new Map(
        assignments.map((assignment) => [assignment.customerId, assignment]),
      );
      onAssignmentsChange(
        Object.keys(nextSelection)
          .filter((customerId) => nextSelection[customerId])
          .map(
            (customerId) =>
              assignmentByCustomerId.get(customerId) ?? {
                customerId,
                allRoles: false,
                responsibilityRoleIds: [],
              },
          ),
      );
    },
    enableRowSelection: true,
    manualPagination: true,
    pageCount: Math.ceil(tableState.total / tableState.pagination.pageSize),
    getCoreRowModel: getCoreRowModel(),
  });

  if (!employeeHasLinkedAccount) {
    return (
      <AccessNotice>
        Nhân viên chưa liên kết tài khoản nên chưa thể cấp vai trò và phân công
        khách hàng.
      </AccessNotice>
    );
  }

  if (!canManage) {
    return (
      <AccessNotice>
        Bạn không có quyền phân công khách hàng cho nhân viên này.
      </AccessNotice>
    );
  }

  if (isLoading) {
    return <AccessNotice>Đang tải danh sách khách hàng...</AccessNotice>;
  }

  if (error) {
    return (
      <AccessNotice tone="error">{getApiErrorMessage(error)}</AccessNotice>
    );
  }

  if (!customerTable) {
    return <AccessNotice>Chưa sẵn sàng danh sách khách hàng.</AccessNotice>;
  }

  return (
    <CustomerTable
      table={table}
      total={tableState.total}
      isLoading={tableState.isLoading || isLoading}
      isFetching={tableState.isFetching}
      title={
        <p className="text-sm font-medium text-foreground">
          Đã chọn {assignments.length} khách hàng
        </p>
      }
      toolbar={
        <>
          <CustomerFilterBar
            keyword={tableState.keyword}
            onKeywordChange={tableState.setKeyword}
            disabled={tableState.isLoading}
          />
          <DataGridColumnVisibility table={table} mode="drawer" />
        </>
      }
      emptyMessage="Không tìm thấy khách hàng phù hợp."
      className="min-h-0 min-w-0 flex-1"
      cardClassName="min-h-0"
    />
  );
}

export function EmployeeCustomerRoleStep({
  roleOptions,
  employeeRoleIds,
  customers,
  assignments,
  onAssignmentsChange,
  canManage,
  employeeHasLinkedAccount,
  isLoading = false,
  error,
}: EmployeeResponsibilityEditorProps) {
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkRoleIds, setBulkRoleIds] = useState<string[]>([]);
  const employeeRoleIdSet = useMemo(
    () => new Set(employeeRoleIds),
    [employeeRoleIds],
  );
  const customerRoleOptions = useMemo<MultiSelectOption<EmployeeRoleOption>[]>(
    () =>
      roleOptions
        .filter(
          (role) =>
            role.customerAssignable &&
            role.isActive &&
            employeeRoleIdSet.has(role.id),
        )
        .map((role) => ({
          value: role.id,
          label: role.name,
          searchableText: role.name,
          data: role,
        })),
    [employeeRoleIdSet, roleOptions],
  );
  function renderCustomerRoleBadge(
    option: MultiSelectOption<EmployeeRoleOption>,
    onRemove: () => void,
  ) {
    if (!option.data) return option.label;

    return <EmployeeRoleBadge role={option.data} onRemove={onRemove} />;
  }
  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const allowedRoleIds = useMemo(
    () =>
      new Set(
        roleOptions
          .filter(
            (role) => role.customerAssignable && employeeRoleIdSet.has(role.id),
          )
          .map((role) => role.id),
      ),
    [employeeRoleIdSet, roleOptions],
  );

  useEffect(() => {
    const nextAssignments = assignments.map((assignment) => ({
      ...assignment,
      responsibilityRoleIds: assignment.responsibilityRoleIds.filter((roleId) =>
        allowedRoleIds.has(roleId),
      ),
    }));
    if (JSON.stringify(nextAssignments) !== JSON.stringify(assignments)) {
      onAssignmentsChange(nextAssignments);
    }
  }, [allowedRoleIds, assignments, onAssignmentsChange]);

  if (!employeeHasLinkedAccount) {
    return (
      <AccessNotice>
        Nhân viên chưa liên kết tài khoản nên chưa thể cấp vai trò và phân công
        khách hàng.
      </AccessNotice>
    );
  }

  if (isLoading) {
    return <AccessNotice>Đang tải dữ liệu phân công...</AccessNotice>;
  }

  if (error) {
    return (
      <AccessNotice tone="error">{getApiErrorMessage(error)}</AccessNotice>
    );
  }

  if (assignments.length === 0) {
    return <AccessNotice>Chưa chọn khách hàng nào ở bước trước.</AccessNotice>;
  }

  const selectedCount = assignments.filter((assignment) =>
    selectedCustomerIds.has(assignment.customerId),
  ).length;
  const allCustomersSelected = selectedCount === assignments.length;

  function toggleAllCustomers(checked: boolean) {
    setSelectedCustomerIds(
      checked
        ? new Set(assignments.map((assignment) => assignment.customerId))
        : new Set(),
    );
  }

  function toggleCustomer(customerId: string, checked: boolean) {
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      if (checked) next.add(customerId);
      else next.delete(customerId);
      return next;
    });
  }

  function removeCustomer(customerId: string) {
    onAssignmentsChange(
      assignments.filter((assignment) => assignment.customerId !== customerId),
    );
    toggleCustomer(customerId, false);
  }

  function applyBulkRoles() {
    if (!canManage || bulkRoleIds.length === 0) return;
    onAssignmentsChange(
      assignments.map((assignment) =>
        selectedCustomerIds.has(assignment.customerId)
          ? {
              ...assignment,
              allRoles: false,
              responsibilityRoleIds: bulkRoleIds,
            }
          : assignment,
      ),
    );
    setBulkRoleIds([]);
  }

  function toggleAllCustomerRoles(customerId: string, checked: boolean) {
    onAssignmentsChange(
      assignments.map((assignment) =>
        assignment.customerId === customerId
          ? {
              ...assignment,
              allRoles: checked,
              responsibilityRoleIds: checked
                ? []
                : assignment.responsibilityRoleIds,
            }
          : assignment,
      ),
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
          Phân công vai trò cho từng khách hàng
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <MultiSelect
            value={bulkRoleIds}
            options={customerRoleOptions}
            onChange={setBulkRoleIds}
            placeholder="Vai trò hàng loạt"
            searchPlaceholder="Tìm vai trò..."
            emptyMessage="Không có vai trò phù hợp"
            disabled={!canManage || selectedCount === 0}
            showSelectedOptionWrapper
            renderSelectedOption={renderCustomerRoleBadge}
            size="sm"
            className="min-w-52"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={
              !canManage || selectedCount === 0 || bulkRoleIds.length === 0
            }
            onClick={applyBulkRoles}
          >
            Áp dụng ({selectedCount})
          </Button>
        </div>
      </div>
      {customerRoleOptions.length === 0 ? (
        <AccessNotice>
          Nhân viên chưa được cấp vai trò có thể phụ trách khách hàng. Quay lại
          bước 1 để bổ sung vai trò.
        </AccessNotice>
      ) : null}
      <div className="min-h-0 overflow-hidden rounded-lg border border-border">
        <div className="max-h-[min(52dvh,430px)] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox
                    aria-label="Chọn tất cả khách hàng phụ trách"
                    checked={allCustomersSelected}
                    onCheckedChange={(value) =>
                      toggleAllCustomers(value === true)
                    }
                  />
                </TableHead>
                <TableHead>Khách hàng phụ trách</TableHead>
                <TableHead className="w-36">
                  <div className="flex items-center gap-1">
                    <span>Tất cả vai trò</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          tabIndex={0}
                          aria-label="Áp dụng tất cả vai trò của nhân viên"
                          className="inline-flex size-4 items-center justify-center text-muted-foreground"
                        >
                          <Info className="size-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Áp dụng tất cả vai trò của nhân viên
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="min-w-[280px]">
                  Vai trò nhân viên
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => {
                const customer = customerById.get(assignment.customerId);
                if (!customer) return null;
                const hasNoRole =
                  !assignment.allRoles &&
                  assignment.responsibilityRoleIds.length === 0;
                return (
                  <TableRow key={assignment.customerId}>
                    <TableCell className="w-12 text-center">
                      <Checkbox
                        aria-label={`Chọn ${customer.name}`}
                        checked={selectedCustomerIds.has(customer.id)}
                        onCheckedChange={(value) =>
                          toggleCustomer(customer.id, value === true)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <CustomerIdentity customer={customer} />
                    </TableCell>
                    <TableCell className="w-36">
                      <Checkbox
                        aria-label={`Áp dụng tất cả vai trò cho ${customer.name}`}
                        checked={assignment.allRoles}
                        disabled={!canManage}
                        onCheckedChange={(value) =>
                          toggleAllCustomerRoles(customer.id, value === true)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <MultiSelect
                        value={
                          assignment.allRoles
                            ? []
                            : assignment.responsibilityRoleIds
                        }
                        options={customerRoleOptions}
                        onChange={(roleIds) =>
                          onAssignmentsChange(
                            assignments.map((item) =>
                              item.customerId === assignment.customerId
                                ? {
                                    ...item,
                                    allRoles: false,
                                    responsibilityRoleIds: roleIds,
                                  }
                                : item,
                            ),
                          )
                        }
                        placeholder="Chọn vai trò"
                        searchPlaceholder="Tìm vai trò..."
                        emptyMessage="Không có vai trò phù hợp"
                        disabled={!canManage || assignment.allRoles}
                        showSelectedOptionWrapper
                        renderSelectedOption={renderCustomerRoleBadge}
                        selectedOptionsLayout="stacked"
                        size="md"
                        className={hasNoRole ? 'border-destructive' : undefined}
                      />
                      {hasNoRole ? (
                        <p className="mt-1 text-xs text-destructive">
                          Cần chọn ít nhất một vai trò phụ trách.
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="w-12 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Bỏ phân công ${customer.name}`}
                        title={`Bỏ phân công ${customer.name}`}
                        disabled={!canManage}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeCustomer(customer.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function AccessNotice({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'error';
}) {
  return (
    <div
      className={
        tone === 'error'
          ? 'rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive'
          : 'rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground'
      }
    >
      {children}
    </div>
  );
}
