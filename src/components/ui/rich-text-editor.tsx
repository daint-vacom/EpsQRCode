import * as React from 'react';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code2,
  Heading2,
  Italic,
  List,
  ListChecks,
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
  onBeforePress?: () => void;
  onPressedChange: () => void;
  children: React.ReactNode;
}

function ToolbarToggle({
  label,
  pressed,
  disabled,
  onBeforePress,
  onPressedChange,
  children,
}: ToolbarToggleProps) {
  const preventToolbarFocus = (event: React.SyntheticEvent) => {
    event.preventDefault();
    onBeforePress?.();
  };

  return (
    <Toggle
      type="button"
      size="sm"
      variant="solid-neutral"
      pressed={pressed}
      disabled={disabled}
      aria-label={label}
      title={label}
      onPointerDown={preventToolbarFocus}
      onMouseDown={preventToolbarFocus}
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

type EditorChain = ReturnType<Editor['chain']>;

function runToolbarCommand(
  editor: Editor,
  selection: { from: number; to: number } | null,
  command: (chain: EditorChain) => EditorChain,
) {
  const chain = editor.chain().focus(undefined, { scrollIntoView: false });

  if (selection) {
    chain.setTextSelection(selection);
  }

  command(chain).run();
}

const RICH_TEXT_CONTENT_CLASS =
  'w-full text-sm leading-6 text-foreground outline-none [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_h2]:my-3 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul[data-type=taskList]]:!list-none [&_ul[data-type=taskList]]:!pl-0 [&_ul[data-type=taskList]>li]:my-1 [&_ul[data-type=taskList]>li]:flex [&_ul[data-type=taskList]>li]:items-start [&_ul[data-type=taskList]>li]:gap-2 [&_ul[data-type=taskList]>li>label]:mt-1 [&_ul[data-type=taskList]>li>label]:flex [&_ul[data-type=taskList]>li>label]:shrink-0 [&_ul[data-type=taskList]>li>label>input]:size-4 [&_ul[data-type=taskList]>li>label>input]:accent-primary [&_ul[data-type=taskList]>li>div]:min-w-0 [&_ul[data-type=taskList]>li[data-checked=true]>div]:text-muted-foreground [&_ul[data-type=taskList]>li[data-checked=true]>div]:line-through [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-3 [&_blockquote]:border-s-2 [&_blockquote]:border-primary/40 [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]';

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
  const toolbarSelectionRef = React.useRef<{
    from: number;
    to: number;
  } | null>(null);
  const [activeFormats, setActiveFormats] = React.useState({
    bold: false,
    italic: false,
    strike: false,
    heading: false,
    bulletList: false,
    orderedList: false,
    taskList: false,
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
      TaskList,
      TaskItem.configure({ nested: true }),
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
        taskList: editor.isActive('taskList'),
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

  const rememberToolbarSelection = () => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    toolbarSelectionRef.current = { from, to };
  };

  const executeToolbarCommand = (
    command: (chain: EditorChain) => EditorChain,
  ) => {
    if (!editor) return;

    runToolbarCommand(editor, toolbarSelectionRef.current, command);
    toolbarSelectionRef.current = null;
  };

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
          onBeforePress={rememberToolbarSelection}
          onPressedChange={() => {
            executeToolbarCommand((chain) => chain.toggleBold());
          }}
        >
          <Bold />
        </ToolbarToggle>
        <ToolbarToggle
          label="In nghiêng"
          pressed={activeFormats.italic}
          disabled={isDisabled}
          onBeforePress={rememberToolbarSelection}
          onPressedChange={() => {
            executeToolbarCommand((chain) => chain.toggleItalic());
          }}
        >
          <Italic />
        </ToolbarToggle>
        <ToolbarToggle
          label="Gạch ngang"
          pressed={activeFormats.strike}
          disabled={isDisabled}
          onBeforePress={rememberToolbarSelection}
          onPressedChange={() => {
            executeToolbarCommand((chain) => chain.toggleStrike());
          }}
        >
          <Strikethrough />
        </ToolbarToggle>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ToolbarToggle
          label="Tiêu đề cấp 2"
          pressed={activeFormats.heading}
          disabled={isDisabled}
          onBeforePress={rememberToolbarSelection}
          onPressedChange={() => {
            executeToolbarCommand((chain) => chain.toggleHeading({ level: 2 }));
          }}
        >
          <Heading2 />
        </ToolbarToggle>
        <ToolbarToggle
          label="Danh sách dấu đầu dòng"
          pressed={activeFormats.bulletList}
          disabled={isDisabled}
          onBeforePress={rememberToolbarSelection}
          onPressedChange={() => {
            executeToolbarCommand((chain) => chain.toggleBulletList());
          }}
        >
          <List />
        </ToolbarToggle>
        <ToolbarToggle
          label="Danh sách đánh số"
          pressed={activeFormats.orderedList}
          disabled={isDisabled}
          onBeforePress={rememberToolbarSelection}
          onPressedChange={() => {
            executeToolbarCommand((chain) => chain.toggleOrderedList());
          }}
        >
          <ListOrdered />
        </ToolbarToggle>
        <ToolbarToggle
          label="Danh sách checklist"
          pressed={activeFormats.taskList}
          disabled={isDisabled}
          onBeforePress={rememberToolbarSelection}
          onPressedChange={() => {
            executeToolbarCommand((chain) => chain.toggleTaskList());
          }}
        >
          <ListChecks />
        </ToolbarToggle>
        <ToolbarToggle
          label="Trích dẫn"
          pressed={activeFormats.blockquote}
          disabled={isDisabled}
          onBeforePress={rememberToolbarSelection}
          onPressedChange={() => {
            executeToolbarCommand((chain) => chain.toggleBlockquote());
          }}
        >
          <Quote />
        </ToolbarToggle>
        <ToolbarToggle
          label="Khối mã"
          pressed={activeFormats.codeBlock}
          disabled={isDisabled}
          onBeforePress={rememberToolbarSelection}
          onPressedChange={() => {
            executeToolbarCommand((chain) => chain.toggleCodeBlock());
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
  onChange,
  className,
}: {
  content: string;
  onChange?: (value: string) => void;
  className?: string;
}) {
  const onChangeRef = React.useRef(onChange);
  const editorRef = React.useRef<Editor | null>(null);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    editable: false,
    content: normalizeEditorContent(content),
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({
        nested: true,
        onReadOnlyChecked: (node, checked) => {
          const currentEditor = editorRef.current;
          if (!currentEditor) return false;

          let position: number | null = null;
          currentEditor.state.doc.descendants(
            (currentNode, currentPosition) => {
              if (currentNode.eq(node)) {
                position = currentPosition;
                return false;
              }

              return true;
            },
          );

          if (position === null) return false;

          const currentNode = currentEditor.state.doc.nodeAt(position);
          if (!currentNode) return false;

          currentEditor.view.dispatch(
            currentEditor.state.tr.setNodeMarkup(position, undefined, {
              ...currentNode.attrs,
              checked,
            }),
          );
          onChangeRef.current?.(currentEditor.getHTML());
          return true;
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: RICH_TEXT_CONTENT_CLASS,
      },
    },
  });

  React.useEffect(() => {
    editorRef.current = editor;

    return () => {
      editorRef.current = null;
    };
  }, [editor]);

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
