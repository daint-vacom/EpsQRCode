import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImageAvatar } from './image-avatar';

describe('ImageAvatar', () => {
  it('applies the requested fallback tone', () => {
    render(
      <ImageAvatar alt="Ảnh nhân viên" fallback="ĐN" fallbackTone="slate" />,
    );

    expect(screen.getByText('ĐN')).toHaveClass(
      'from-[#ecf0f1]',
      'to-[#90a4ae]',
      'text-[#455a64]',
    );
  });
});
