import { useIntl } from 'react-intl';
import { Switch } from '@/components/ui/switch';
import type { Material } from '../model/material';

export function MaterialAvailabilityCell({
  material,
  canManage,
  isPending,
  onChange,
}: {
  material: Material;
  canManage: boolean;
  isPending: boolean;
  onChange: (material: Material, isActive: boolean) => void;
}) {
  const intl = useIntl();

  return (
    <Switch
      checked={material.isActive}
      disabled={!canManage || isPending}
      onCheckedChange={(checked) => onChange(material, checked)}
      aria-label={intl.formatMessage(
        {
          id: material.isActive
            ? 'project.materials.fields.disable'
            : 'project.materials.fields.enable',
        },
        { name: material.nameOverride?.trim() || material.modelSnapshot.name },
      )}
    />
  );
}
