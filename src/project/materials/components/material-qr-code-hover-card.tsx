import { useIntl } from 'react-intl';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { MaterialQrCode } from './material-qr-code';

interface MaterialQrCodeHoverCardProps {
  materialId: string;
  materialCode: string;
  size?: number;
  previewSize?: number;
}

export function MaterialQrCodeHoverCard({
  materialId,
  materialCode,
  size = 40,
  previewSize = 240,
}: MaterialQrCodeHoverCardProps) {
  const intl = useIntl();
  const label = intl.formatMessage(
    { id: 'project.materials.actions.expandQrCode' },
    { code: materialCode },
  );

  return (
    <HoverCard openDelay={300} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="mx-auto flex w-fit cursor-zoom-in items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MaterialQrCode
            materialId={materialId}
            materialCode={materialCode}
            size={size}
            className="block"
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="right" sideOffset={8} className="w-fit p-3">
        <MaterialQrCode
          materialId={materialId}
          materialCode={materialCode}
          size={previewSize}
          className="block"
        />
      </HoverCardContent>
    </HoverCard>
  );
}
