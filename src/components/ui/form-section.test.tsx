import { render, screen } from '@testing-library/react';
import { Building2 } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { FormSection } from './form-section';

describe('FormSection', () => {
  it('renders a shared heading with the configured icon style', () => {
    render(
      <FormSection heading="Thông tin cơ bản" icon={Building2}>
        <div>Form content</div>
      </FormSection>,
    );

    expect(
      screen.getByRole('heading', { name: 'Thông tin cơ bản' }),
    ).toHaveClass('text-base', 'font-semibold', 'text-foreground');
    const icon = screen
      .getByRole('heading', { name: 'Thông tin cơ bản' })
      .querySelector('[data-slot="form-section-icon"]');

    expect(icon).not.toBeNull();
    expect(icon).toHaveClass(
      'size-8',
      'rounded-lg',
      'bg-admin-blue-bg',
      'text-admin-blue-primary',
    );
    expect(screen.getByText('Form content')).toBeInTheDocument();
  });
});
