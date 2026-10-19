import { Plus } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { CardHeader } from '@/components/ui/card';

type MaterialSpecificationsTableHeaderProps =
  | {
      mode: 'model';
      count: number;
      onAddRow: () => void;
    }
  | {
      mode: 'material';
      count: number;
    };

export function MaterialSpecificationsTableHeader(
  props: MaterialSpecificationsTableHeaderProps,
) {
  const intl = useIntl();

  return (
    <CardHeader className="border-b border-border">
      <span className="text-sm font-medium text-foreground">
        {intl.formatMessage(
          { id: 'materialModels.specifications.count' },
          { count: props.count },
        )}
      </span>
      {props.mode === 'model' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={props.onAddRow}
        >
          <Plus />
          {intl.formatMessage({ id: 'materialModels.specifications.add' })}
        </Button>
      ) : null}
    </CardHeader>
  );
}
