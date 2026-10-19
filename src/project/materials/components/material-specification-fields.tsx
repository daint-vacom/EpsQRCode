import type { MaterialModelSpecification } from '@/project/material-models/model/material-model';
import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function MaterialSpecificationFields({
  specifications,
  modelName,
  values,
  onChange,
}: {
  specifications: MaterialModelSpecification[];
  modelName: string;
  values: Record<string, string[]>;
  onChange: (values: Record<string, string[]>) => void;
}) {
  const intl = useIntl();
  const configuredSpecifications = specifications
    .map((specification) => ({
      ...specification,
      values: specification.values.filter((value) => value.trim().length > 0),
    }))
    .filter((specification) => specification.values.length > 0);

  if (configuredSpecifications.length === 0) {
    return (
      <p className="rounded-admin-control border border-dashed border-border bg-admin-surface-alt px-3 py-6 text-center text-sm text-muted-foreground">
        {intl.formatMessage({ id: 'project.materials.empty.specifications' })}
      </p>
    );
  }

  const updateValues = (specificationId: string, nextValues: string[]) => {
    const next = { ...values };
    if (nextValues.length === 0) delete next[specificationId];
    else next[specificationId] = nextValues;
    onChange(next);
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          {intl.formatMessage(
            { id: 'project.materials.form.inheritedSpecifications' },
            { count: configuredSpecifications.length },
          )}
        </p>
        <Badge variant="secondary" appearance="light">
          {modelName}
        </Badge>
      </div>

      {configuredSpecifications.map((specification) => {
        const configuredValues = specification.values;
        const selectedValues = values[specification.id] ?? [];
        const isSingleValue = configuredValues.length === 1;
        const options = configuredValues.map((value) => ({
          value,
          label: value,
        }));
        const labelId = `material-specification-${specification.id}`;

        return (
          <div
            key={specification.id}
            className="grid gap-2 rounded-admin-control border border-border p-3 sm:grid-cols-[minmax(160px,0.7fr)_minmax(0,1.3fr)] sm:items-center"
          >
            <Label id={labelId} className="text-sm font-medium text-foreground">
              {specification.name}
            </Label>

            {isSingleValue ? (
              <Input
                aria-labelledby={labelId}
                variant="md"
                value={selectedValues[0] ?? configuredValues[0]}
                readOnly
              />
            ) : specification.isList ? (
              <MultiSelect
                ariaLabel={specification.name}
                value={selectedValues}
                options={options}
                placeholder={intl.formatMessage({
                  id: 'project.materials.form.chooseSpecificationValues',
                })}
                searchPlaceholder={intl.formatMessage({
                  id: 'project.materials.form.searchSpecificationValues',
                })}
                onChange={(nextValues) =>
                  updateValues(specification.id, nextValues)
                }
              />
            ) : (
              <Select
                value={selectedValues[0] ?? ''}
                onValueChange={(value) =>
                  updateValues(specification.id, [value])
                }
              >
                <SelectTrigger aria-labelledby={labelId}>
                  <SelectValue
                    placeholder={intl.formatMessage({
                      id: 'project.materials.form.chooseSpecificationValue',
                    })}
                  />
                </SelectTrigger>
                <SelectContent>
                  {configuredValues.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        );
      })}
    </section>
  );
}
