import { ClipboardPaste, MoreVertical, Plus } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { CardHeader } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type MaterialSpecificationsTableHeaderProps = {
  title?: string;
  clipboardCount?: number;
  onPaste?: () => void;
} & (
  | {
      mode: 'model';
      count: number;
      onAddRow: () => void;
    }
  | {
      mode: 'material';
      count: number;
    }
);

export function MaterialSpecificationsTableHeader(
  props: MaterialSpecificationsTableHeaderProps,
) {
  const intl = useIntl();

  return (
    <CardHeader className="border-b border-border">
      <div className="flex min-w-0 flex-col gap-0.5">
        {props.title ? (
          <span className="text-sm font-medium text-foreground">
            {props.title}
          </span>
        ) : null}
        <span
          className={
            props.title
              ? 'text-xs text-muted-foreground'
              : 'text-sm font-medium text-foreground'
          }
        >
          {intl.formatMessage(
            { id: 'materialModels.specifications.count' },
            { count: props.count },
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {props.clipboardCount && props.clipboardCount > 0 && props.onPaste ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="sm"
                aria-label={intl.formatMessage({
                  id: 'materialModels.specifications.selection.moreActions',
                })}
                title={intl.formatMessage({
                  id: 'materialModels.specifications.selection.moreActions',
                })}
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onSelect={props.onPaste}>
                <ClipboardPaste />
                {intl.formatMessage(
                  { id: 'materialModels.specifications.selection.pasteCount' },
                  { count: props.clipboardCount },
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
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
      </div>
    </CardHeader>
  );
}
