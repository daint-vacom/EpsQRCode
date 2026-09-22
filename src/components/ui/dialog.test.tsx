import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from './dialog';

describe('DialogContent', () => {
  it('uses a borderless shell by default and collapses outer spacing around header and footer', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader />
          <div>Content</div>
          <DialogFooter />
        </DialogContent>
      </Dialog>,
    );

    const content = screen.getByRole('dialog');

    expect(content).toHaveClass('border-0');
    expect(content).toHaveClass('has-[[data-slot=dialog-header]]:pt-0');
    expect(content).toHaveClass('has-[[data-slot=dialog-footer]]:pb-0');
  });
});
