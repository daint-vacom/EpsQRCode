import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

  it('creates a checklist from the editor toolbar', async () => {
    const user = userEvent.setup();

    render(<RichTextEditor />);

    await user.click(
      screen.getByRole('button', { name: 'Danh sách checklist' }),
    );

    expect(await screen.findByRole('checkbox')).toBeInTheDocument();
  });

  it('renders stored HTML through the read-only content view', async () => {
    render(<RichTextContent content="<h2>Tiêu đề</h2><p>Nội dung</p>" />);

    expect(await screen.findByText('Tiêu đề')).toBeInTheDocument();
    expect(screen.getByText('Nội dung')).toBeInTheDocument();
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('allows checking checklist items in the read-only content view', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <RichTextContent
        content={
          '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Việc 1</p></li></ul>'
        }
        onChange={onChange}
      />,
    );

    const checkbox = await screen.findByRole('checkbox', { name: /Việc 1/ });
    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('data-checked="true"'),
    );
  });
});
