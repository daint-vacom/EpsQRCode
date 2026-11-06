import { useIntl } from 'react-intl';
import type { Material } from '../model/material';
import { MaterialQrCode } from './material-qr-code';

export function MaterialQrCodeButton({
  material,
  onOpen,
  size = 40,
}: {
  material: Material;
  onOpen: (material: Material) => void;
  size?: number;
}) {
  const intl = useIntl();
  if (!material.isActive) return null;

  return (
    <button
      type="button"
      aria-label={intl.formatMessage(
        { id: 'project.materials.actions.expandQrCode' },
        { code: material.code },
      )}
      onClick={() => onOpen(material)}
      className="mx-auto flex w-fit cursor-zoom-in items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <MaterialQrCode
        materialId={material.id}
        materialCode={material.code}
        size={size}
        className="block"
      />
    </button>
  );
}
