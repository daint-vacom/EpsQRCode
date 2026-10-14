import { forwardRef, useEffect, useState } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getCodePatternExample } from '../model/code-pattern-example';

interface CodeInputFieldProps extends ComponentPropsWithoutRef<typeof Input> {
  mode: 'create' | 'edit';
  codeMode?: 'auto' | 'manual';
  pattern: string;
  resetKey?: string;
  showCodeModeSelector?: boolean;
  onCodeModeChange?: (codeMode: 'auto' | 'manual') => void;
}

export const CodeInputField = forwardRef<HTMLInputElement, CodeInputFieldProps>(
  function CodeInputField(
    {
      mode,
      codeMode = 'auto',
      pattern,
      resetKey,
      showCodeModeSelector = false,
      onCodeModeChange,
      ...inputProps
    },
    ref,
  ) {
    const intl = useIntl();
    const [isEditable, setIsEditable] = useState(false);

    useEffect(() => {
      setIsEditable(false);
    }, [mode, resetKey]);

    const isReadOnly = mode === 'edit' ? !isEditable : codeMode === 'auto';

    return (
      <div className="flex min-w-0 flex-col items-stretch gap-2">
        {showCodeModeSelector && mode === 'create' && (
          <RadioGroup
            aria-label={intl.formatMessage({
              id: 'common.fields.codeCreation',
            })}
            className="flex min-h-9 flex-wrap items-center gap-5"
            value={codeMode}
            onValueChange={(value) =>
              onCodeModeChange?.(value as 'auto' | 'manual')
            }
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem
                value="auto"
                aria-label={intl.formatMessage({
                  id: 'common.fields.codeAuto',
                })}
              />
              {intl.formatMessage({ id: 'common.fields.codeAuto' })}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem
                value="manual"
                aria-label={intl.formatMessage({
                  id: 'common.fields.codeManual',
                })}
              />
              {intl.formatMessage({ id: 'common.fields.codeManual' })}
            </label>
          </RadioGroup>
        )}

        <div className="flex min-w-0 items-center gap-2">
          <Input
            {...inputProps}
            ref={ref}
            readOnly={isReadOnly}
            placeholder={getCodePatternExample(pattern)}
          />
          {mode === 'edit' && !isEditable && (
            <Button
              type="button"
              variant="ghost"
              mode="link"
              size="sm"
              className="shrink-0"
              onClick={() => setIsEditable(true)}
            >
              {intl.formatMessage({ id: 'common.actions.editCode' })}
            </Button>
          )}
        </div>
      </div>
    );
  },
);
