import {
  CalendarDays,
  Hash,
  Palette,
  Ruler,
  Scale,
  ToggleLeft,
  Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MaterialSpecificationDataType } from '../model/material-specification';

const dataTypeIcons: Record<MaterialSpecificationDataType, LucideIcon> = {
  text: Type,
  number: Hash,
  boolean: ToggleLeft,
  date: CalendarDays,
  color: Palette,
  length: Ruler,
  weight: Scale,
};

export function MaterialSpecificationDataTypeIcon({
  dataType,
  className,
}: {
  dataType: MaterialSpecificationDataType;
  className?: string;
}) {
  const intl = useIntl();
  const Icon = dataTypeIcons[dataType];
  const label = intl.formatMessage({
    id: `materialModels.specifications.types.${dataType}`,
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={label}
          className={cn(
            'inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground',
            className,
          )}
        >
          <Icon className="size-full" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
