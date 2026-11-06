import { useIntl } from 'react-intl';
import type { SafetyInspectionChecklistGroup } from '../model/safety-inspection-checklist';

export function SafetyInspectionChecklistDisplay({
  groups,
  emptyMessageId = 'project.materials.safetyInspection.checklist.empty',
}: {
  groups: SafetyInspectionChecklistGroup[];
  emptyMessageId?: string;
}) {
  const intl = useIntl();

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {intl.formatMessage({ id: emptyMessageId })}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.id} className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {group.name}
          </h3>
          <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
            {group.criteria.map((criterion) => (
              <li key={criterion.id}>{criterion.content}</li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
