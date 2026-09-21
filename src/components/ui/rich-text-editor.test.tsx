import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RichTextContent, RichTextEditor } from './rich-text-editor';

describe('RichTextEditor', () => {
  it('renders existing HTML content and the formatting toolbar', async () => {
    const user = userEvent.setup();

    render(<RichTextEditor value="<p>Nội dung cũ</p>" />);

    const editor = await screen.findByRole('textbox', { name: 'Mô tả' });
    expect(editor).toHaveTextContent('Nội dung cũ');
    expect(
      screen.getByRole('toolbar', { name: 'Định dạng mô tả' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In đậm' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'In đậm' }));
    expect(screen.getByRole('button', { name: 'In đậm' })).toHaveAttribute(
      'data-state',
      'on',
    );
    expect(screen.getByRole('button', { name: 'In đậm' })).toHaveClass(
      'data-[state=on]:bg-zinc-950',
      'data-[state=on]:text-white',
    );
  });

  it('renders an empty editor without serializing placeholder markup', async () => {
    render(<RichTextEditor />);

    const editor = await screen.findByRole('textbox', { name: 'Mô tả' });
    expect(editor).toHaveTextContent('');
    expect(editor).toHaveAttribute('aria-multiline', 'true');
  });

  it('renders stored HTML through the read-only content view', async () => {
    render(<RichTextContent content="<h2>Tiêu đề</h2><p>Nội dung</p>" />);

    expect(await screen.findByText('Tiêu đề')).toBeInTheDocument();
    expect(screen.getByText('Nội dung')).toBeInTheDocument();
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });
});
