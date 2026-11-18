import { Plus, X } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { LinkedCode } from '../model/linked-code';

interface LinkedCodesEditorProps {
  label: string;
  value: LinkedCode[];
  onChange: (value: LinkedCode[]) => void;
}

export function LinkedCodesEditor({
  label,
  value,
  onChange,
}: LinkedCodesEditorProps) {
  const intl = useIntl();

  const updateItem = (index: number, patch: Partial<LinkedCode>) => {
    onChange(
      value.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  return (
    <FormItem layout="horizontal" labelWidth="md" alignment="start">
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <div className="flex min-w-0 flex-col gap-2">
          {value.map((item, index) => (
            <div className="flex min-w-0 items-center gap-2" key={index}>
              <Input
                aria-label={intl.formatMessage({
                  id: 'project.materials.linkedCodes.label',
                })}
                value={item.label}
                onChange={(event) =>
                  updateItem(index, { label: event.target.value })
                }
              />
              <Input
                aria-label={intl.formatMessage({
                  id: 'project.materials.linkedCodes.value',
                })}
                value={item.value}
                onChange={(event) =>
                  updateItem(index, { value: event.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                mode="icon"
                size="sm"
                aria-label={intl.formatMessage({
                  id: 'project.materials.linkedCodes.remove',
                })}
                onClick={() =>
                  onChange(value.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                <X />
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange([...value, { label: '', value: '' }])}
            >
              <Plus />
              {intl.formatMessage({ id: 'project.materials.linkedCodes.add' })}
            </Button>
          </div>
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
