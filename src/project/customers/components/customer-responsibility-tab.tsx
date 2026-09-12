import type { CustomerResponsibilityAssignmentInput } from '../model/customer-responsibility';
import {
  CustomerResponsibilityEditor,
  type CustomerResponsibilityEditorProps,
} from './customer-responsibility-dialog';

export interface CustomerResponsibilityTabProps extends Pick<
  CustomerResponsibilityEditorProps,
  | 'tenantId'
  | 'customerId'
  | 'canManage'
  | 'draftAssignments'
  | 'onValidationChange'
> {
  onAssignmentsChange: (
    assignments: CustomerResponsibilityAssignmentInput[],
  ) => void;
}

export function CustomerResponsibilityTab({
  tenantId,
  customerId,
  canManage,
  draftAssignments,
  onAssignmentsChange,
  onValidationChange,
}: CustomerResponsibilityTabProps) {
  return (
    <div className="px-1 pb-1">
      <CustomerResponsibilityEditor
        tenantId={tenantId}
        customerId={customerId}
        canManage={canManage}
        draftAssignments={draftAssignments}
        onAssignmentsChange={onAssignmentsChange}
        onValidationChange={onValidationChange}
      />
    </div>
  );
}
