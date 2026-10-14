import { forwardRef, useEffect, useState } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getCodePatternExample } from '../model/code-pattern-example';

interface CodeInputFieldProps extends ComponentPropsWithoutRef<typeof Input> {
  mode: 'create' | 'edit';
  codeMode?: 'auto' | 'manual';
  pattern: string;
  resetKey?: string;
}

export const CodeInputField = forwardRef<HTMLInputElement, CodeInputFieldProps>(
  function CodeInputField(
    { mode, codeMode = 'auto', pattern, resetKey, ...inputProps },
    ref,
  ) {
    const intl = useIntl();
    const [isEditable, setIsEditable] = useState(false);

    useEffect(() => {
      setIsEditable(false);
    }, [mode, resetKey]);

    const isReadOnly = mode === 'edit' ? !isEditable : codeMode === 'auto';

    return (
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
    );
  },
);
