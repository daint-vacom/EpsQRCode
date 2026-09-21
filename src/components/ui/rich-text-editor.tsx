import * as React from 'react';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code2,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';

export interface RichTextEditorProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'onBlur'
> {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

interface ToolbarToggleProps {
  label: string;
  pressed: boolean;
  disabled: boolean;
  onPressedChange: () => void;
  children: React.ReactNode;
}

function ToolbarToggle({
  label,
  pressed,
  disabled,
  onPressedChange,
  children,
}: ToolbarToggleProps) {
  return (
    <Toggle
      type="button"
      size="sm"
      variant="solid-neutral"
      pressed={pressed}
      disabled={disabled}
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onPressedChange={onPressedChange}
    >
      {children}
    </Toggle>
  );
}

function normalizeEditorContent(value: string | undefined) {
  return value?.trim() || '<p></p>';
}

function serializeEditorContent(editor: {
  getHTML: () => string;
  getText: () => string;
}) {
  return editor.getText().trim() ? editor.getHTML() : '';
}

const RICH_TEXT_CONTENT_CLASS =
  'w-full text-sm leading-6 text-foreground outline-none [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_h2]:my-3 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-3 [&_blockquote]:border-s-2 [&_blockquote]:border-primary/40 [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]';

export function RichTextEditor({
  value = '',
  onChange,
  onBlur,
  placeholder = 'Mô tả mục tiêu, bối cảnh hoặc kết quả cần đạt...',
  disabled = false,
  className,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel = 'Mô tả',
  ...containerProps
}: RichTextEditorProps) {
  const onChangeRef = React.useRef(onChange);
  const onBlurRef = React.useRef(onBlur);
  const [activeFormats, setActiveFormats] = React.useState({
    bold: false,
    italic: false,
    strike: false,
    heading: false,
    bulletList: false,
    orderedList: false,
    blockquote: false,
    codeBlock: false,
  });

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);

  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
        includeChildren: true,
      }),
    ],
    content: normalizeEditorContent(value),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        'aria-label': ariaLabel,
        ...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {}),
        ...(ariaInvalid ? { 'aria-invalid': String(ariaInvalid) } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
        class: `min-h-44 px-4 py-3 transition-colors ${RICH_TEXT_CONTENT_CLASS}`,
      },
      handleDOMEvents: {
        blur: () => {
          onBlurRef.current?.();
          return false;
        },
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      onChangeRef.current?.(serializeEditorContent(updatedEditor));
    },
  });

  React.useEffect(() => {
    if (!editor) return;

    editor.setEditable(!disabled);
  }, [disabled, editor]);

  React.useEffect(() => {
    if (!editor) return;

    const syncActiveFormats = () => {
      setActiveFormats({
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        strike: editor.isActive('strike'),
        heading: editor.isActive('heading', { level: 2 }),
        bulletList: editor.isActive('bulletList'),
        orderedList: editor.isActive('orderedList'),
        blockquote: editor.isActive('blockquote'),
        codeBlock: editor.isActive('codeBlock'),
      });
    };

    syncActiveFormats();
    editor.on('selectionUpdate', syncActiveFormats);
    editor.on('transaction', syncActiveFormats);

    return () => {
      editor.off('selectionUpdate', syncActiveFormats);
      editor.off('transaction', syncActiveFormats);
    };
  }, [editor]);

  React.useEffect(() => {
    if (!editor) return;

    const nextContent = normalizeEditorContent(value);
    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [editor, value]);

  const isDisabled = disabled || !editor;
  const canUndo = Boolean(editor?.can().chain().focus().undo().run());
  const canRedo = Boolean(editor?.can().chain().focus().redo().run());
  const invalid = ariaInvalid === true || ariaInvalid === 'true';

  return (
    <div
      {...containerProps}
      className={cn(
        'overflow-hidden rounded-lg border border-input bg-background transition-colors',
        'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20',
        'aria-disabled:pointer-events-none aria-disabled:opacity-60',
        invalid && 'border-destructive/60 focus-within:border-destructive',
        className,
      )}
      aria-disabled={disabled || undefined}
      data-rich-text-editor="true"
    >
      <div
        role="toolbar"
        aria-label="Định dạng mô tả"
        className="flex flex-wrap items-center gap-0.5 border-b border-border/70 bg-muted/20 px-2 py-1.5"
      >
        <ToolbarToggle
          label="In đậm"
          pressed={activeFormats.bold}
          disabled={isDisabled}
          onPressedChange={() => {
            editor?.chain().focus().toggleBold().run();
          }}
        >
          <Bold />
        </ToolbarToggle>
        <ToolbarToggle
          label="In nghiêng"
          pressed={activeFormats.italic}
          disabled={isDisabled}
          onPressedChange={() => {
            editor?.chain().focus().toggleItalic().run();
          }}
        >
          <Italic />
        </ToolbarToggle>
        <ToolbarToggle
          label="Gạch ngang"
          pressed={activeFormats.strike}
          disabled={isDisabled}
          onPressedChange={() => {
            editor?.chain().focus().toggleStrike().run();
          }}
        >
          <Strikethrough />
        </ToolbarToggle>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ToolbarToggle
          label="Tiêu đề cấp 2"
          pressed={activeFormats.heading}
          disabled={isDisabled}
          onPressedChange={() => {
            editor?.chain().focus().toggleHeading({ level: 2 }).run();
          }}
        >
          <Heading2 />
        </ToolbarToggle>
        <ToolbarToggle
          label="Danh sách dấu đầu dòng"
          pressed={activeFormats.bulletList}
          disabled={isDisabled}
          onPressedChange={() => {
            editor?.chain().focus().toggleBulletList().run();
          }}
        >
          <List />
        </ToolbarToggle>
        <ToolbarToggle
          label="Danh sách đánh số"
          pressed={activeFormats.orderedList}
          disabled={isDisabled}
          onPressedChange={() => {
            editor?.chain().focus().toggleOrderedList().run();
          }}
        >
          <ListOrdered />
        </ToolbarToggle>
        <ToolbarToggle
          label="Trích dẫn"
          pressed={activeFormats.blockquote}
          disabled={isDisabled}
          onPressedChange={() => {
            editor?.chain().focus().toggleBlockquote().run();
          }}
        >
          <Quote />
        </ToolbarToggle>
        <ToolbarToggle
          label="Khối mã"
          pressed={activeFormats.codeBlock}
          disabled={isDisabled}
          onPressedChange={() => {
            editor?.chain().focus().toggleCodeBlock().run();
          }}
        >
          <Code2 />
        </ToolbarToggle>

        <div className="ms-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            mode="icon"
            size="sm"
            aria-label="Hoàn tác"
            title="Hoàn tác"
            disabled={isDisabled || !canUndo}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              editor?.chain().focus().undo().run();
            }}
          >
            <Undo2 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            mode="icon"
            size="sm"
            aria-label="Làm lại"
            title="Làm lại"
            disabled={isDisabled || !canRedo}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              editor?.chain().focus().redo().run();
            }}
          >
            <Redo2 />
          </Button>
        </div>
      </div>

      <EditorContent
        editor={editor}
        className="[&_.ProseMirror]:min-h-44 [&_.ProseMirror]:max-h-80 [&_.ProseMirror]:overflow-y-auto"
      />
    </div>
  );
}

export function RichTextContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const editor = useEditor({
    editable: false,
    content: normalizeEditorContent(content),
    extensions: [StarterKit],
    editorProps: {
      attributes: {
        class: RICH_TEXT_CONTENT_CLASS,
      },
    },
  });

  React.useEffect(() => {
    if (!editor) return;

    const nextContent = normalizeEditorContent(content);
    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <EditorContent
      editor={editor}
      className={cn('[&_.ProseMirror]:max-w-none', className)}
    />
  );
}
