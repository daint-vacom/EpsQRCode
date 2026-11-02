import {
  EDITOR_TABLE_FIELD_CONTROL,
  FIELD_ALIGNMENT_CLASS,
} from '../shared/field-control-registry';
import { buildFormFieldControl } from '../shared/form-field-builder';
import {
  editorTableSpecSchema,
  type EditorTableColumnSpec,
  type EditorTableSpec,
  type NormalizedEditorTableSpec,
} from './editor-table-spec';

function banner(specPath?: string): string {
  const source = specPath ? ` from \`${specPath}\`` : '';
  return `/**
 * Scaffolded by editor-table-builder${source}. Run \`npm run gen:editor-table\` — do NOT hand-write this file.
 * You own this file now — fill computed cell stubs and wire it into the page/card layout. To change
 * columns or viewport behavior, edit the spec and re-gen to a scratch path, then reconcile your edits.
 */`;
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function pascalCase(value: string): string {
  return value
    .replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_, __, char: string) =>
      char.toUpperCase(),
    )
    .replace(/[^a-zA-Z0-9]/g, '');
}

function indent(block: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return block
    .split('\n')
    .map((line) => (line.length > 0 ? pad + line : line))
    .join('\n');
}

function widthClass(column: { widthClass?: string }, fallback: string): string {
  return column.widthClass ?? fallback;
}

function scrollAreaClass(spec: NormalizedEditorTableSpec): string {
  const custom = spec.viewport.className;
  if (custom) return custom;

  if (spec.viewport.mode === 'remaining') {
    return spec.toolbar
      ? 'min-w-0 min-h-[360px] min-h-0 flex-1'
      : 'min-w-0 h-full min-h-[360px] min-h-0';
  }
  if (spec.viewport.mode === 'natural') return 'min-w-0';

  const height = spec.viewport.height ?? 'lg';
  const fixedHeights: Record<typeof height, string> = {
    sm: 'h-[clamp(320px,42dvh,480px)]',
    md: 'h-[clamp(400px,52dvh,600px)]',
    lg: 'h-[clamp(480px,62dvh,760px)]',
  };
  return `min-w-0 ${fixedHeights[height]}`;
}

function fieldError(column: Extract<EditorTableColumnSpec, { name: string }>) {
  return `errors?.${column.name}`;
}

function fieldName(
  spec: NormalizedEditorTableSpec,
  columnName: string,
): string {
  return `${spec.arrayName}.\${index}.${columnName}`;
}

function ariaLabel(
  column: Extract<EditorTableColumnSpec, { name: string; header: string }>,
): string {
  return column.ariaLabel ?? column.header;
}

function numberAttrs(
  column: Extract<EditorTableColumnSpec, { kind: 'number' }>,
): string {
  const attrs: string[] = [];
  if (column.min !== undefined) attrs.push(`min={${column.min}}`);
  if (column.max !== undefined) attrs.push(`max={${column.max}}`);
  if (column.step !== undefined) attrs.push(`step={${column.step}}`);
  return attrs.length
    ? `\n${attrs.map((attr) => `        ${attr}`).join('\n')}`
    : '';
}

function inputVariant(
  column: Extract<
    EditorTableColumnSpec,
    { kind: 'text' | 'number' | 'date' | 'autocomplete' }
  >,
) {
  return EDITOR_TABLE_FIELD_CONTROL[column.kind].inputVariant;
}

function bulkEditableColumns(spec: NormalizedEditorTableSpec) {
  return spec.columns.filter(
    (
      column,
    ): column is Extract<
      EditorTableColumnSpec,
      { kind: 'text' | 'number' | 'date' }
    > => {
      return (
        (column.kind === 'text' ||
          column.kind === 'number' ||
          column.kind === 'date') &&
        column.bulkEdit === true
      );
    },
  );
}

function bulkFieldUnion(columns: ReturnType<typeof bulkEditableColumns>) {
  return columns.map((column) => quote(column.name)).join(' | ');
}

function emitBulkFieldOptions(columns: ReturnType<typeof bulkEditableColumns>) {
  return columns
    .map(
      (column) =>
        `  { name: ${quote(column.name)}, label: ${quote(column.header)}, kind: ${quote(column.kind)} },`,
    )
    .join('\n');
}

function tooltipRender(
  column: Extract<EditorTableColumnSpec, { name: string }>,
  control: string,
): string {
  const warningName = `${column.name}Warning`;
  const messageName = `${column.name}Message`;
  const warningExpression = column.warningExpression ?? 'undefined';

  return `render={({ field: inputField }) => {
      const ${warningName} = ${warningExpression};
      const ${messageName} = ${fieldError(column)}?.message ?? ${warningName};

      return ${messageName} ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block w-full">
${indent(control, 14)}
            </span>
          </TooltipTrigger>
          <TooltipContent variant={${fieldError(column)} ? 'destructive' : 'warning'}>
            {${messageName}}
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="block w-full">
${indent(control, 10)}
        </span>
      );
    }}`;
}

function editableCell(
  spec: NormalizedEditorTableSpec,
  column: Extract<EditorTableColumnSpec, { name: string }>,
): string {
  const common = {
    kind: column.kind,
    surface: 'cell' as const,
    fieldExpression: 'inputField',
    variant: inputVariant(column),
    ariaLabelExpression: `\`${ariaLabel(column)} dòng \${index + 1}\``,
    ariaInvalidExpression: `!!${fieldError(column)}`,
    warningExpression: column.warningExpression
      ? `Boolean(${column.name}Warning)`
      : undefined,
    onPointerDownExpression: '(event) => event.stopPropagation()',
    componentName:
      column.kind === 'text' && column.inputType === 'password'
        ? 'PasswordInput'
        : undefined,
  };

  const control =
    column.kind === 'number'
      ? buildFormFieldControl({
          ...common,
          valueExpression: 'inputField.value',
          onChangeExpression: 'inputField.onChange',
          format: column.format,
          className: FIELD_ALIGNMENT_CLASS.right,
          numberAttributes: numberAttrs(column),
        })
      : column.kind === 'date'
        ? buildFormFieldControl({
            ...common,
            calendarLabelExpression: `\`Chọn ${ariaLabel(column).toLowerCase()} dòng \${index + 1}\``,
            format: column.format,
          })
        : column.kind === 'autocomplete'
          ? buildFormFieldControl({
              ...common,
              optionsExpression: `${column.name}Options`,
              emptyMessage: 'Không có dữ liệu phù hợp',
            })
          : buildFormFieldControl({
              ...common,
              inputType: column.inputType,
            });

  return `<TableCell className="px-2 py-2">
  <Controller
    control={form.control}
    name={\`${fieldName(spec, column.name)}\`}
    ${tooltipRender(column, control)}
  />
</TableCell>`;
}

function computedCell(
  column: Extract<EditorTableColumnSpec, { kind: 'computedCurrency' }>,
) {
  const varName = column.id;
  return `<TableCell className="px-4 py-2 text-right tabular-nums">
  {/* TODO(scaffold): calculate ${varName} from row. */}
  {formatCurrencyVND(${varName})}
</TableCell>`;
}

function customCell(
  column: Extract<EditorTableColumnSpec, { kind: 'custom' }>,
) {
  return `<TableCell className="px-2 py-2 align-top">
  {/* TODO(scaffold): render the feature-owned ${column.id} cell. */}
</TableCell>`;
}

function emitHeaderBulkInput(
  column: Extract<EditorTableColumnSpec, { kind: 'text' | 'number' | 'date' }>,
) {
  const control = buildFormFieldControl({
    kind: column.kind,
    surface: 'cell',
    valueExpression: `headerBulkValues.${column.name}`,
    variant: 'md',
    inputType: column.kind === 'text' ? column.inputType : undefined,
    format:
      column.kind === 'number' || column.kind === 'date'
        ? column.format
        : undefined,
    className:
      column.kind === 'number' ? FIELD_ALIGNMENT_CLASS.right : undefined,
    disabledExpression: 'selectedIndexes.length === 0',
    ariaLabelExpression: `\`Áp dụng ${ariaLabel(column).toLowerCase()} cho dòng đã chọn\``,
    calendarLabelExpression:
      column.kind === 'date'
        ? `\`Chọn ${ariaLabel(column).toLowerCase()} cho dòng đã chọn\``
        : undefined,
    onChangeHandlerExpression:
      column.kind === 'date'
        ? `(value) => handleHeaderBulkChange(${quote(column.name)}, value)`
        : `(event) => handleHeaderBulkChange(${quote(column.name)}, event.target.value)`,
  });

  return control;
}

function emitHeaderCell(
  spec: NormalizedEditorTableSpec,
  column: EditorTableColumnSpec,
  isAction = false,
): string {
  if (isAction) {
    return `<TableHead className="sticky top-0 right-0 z-30 bg-muted ${widthClass(column, 'w-28')} text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">${column.header}</TableHead>`;
  }
  const alignRight =
    column.kind === 'number' || column.kind === 'computedCurrency'
      ? ' text-right'
      : '';
  const hasHeaderBulkInput =
    spec.multiEdit.enabled &&
    spec.multiEdit.headerInputs &&
    (column.kind === 'text' ||
      column.kind === 'number' ||
      column.kind === 'date') &&
    column.bulkEdit === true;
  const headerContent = hasHeaderBulkInput
    ? `<div className="flex flex-col gap-1.5">
  <span>${column.header}</span>
  ${emitHeaderBulkInput(column)}
</div>`
    : column.header;
  return `<TableHead className="sticky top-0 z-20 bg-muted ${widthClass(column, 'w-36')}${alignRight}">${headerContent}</TableHead>`;
}

function emitHeaders(spec: NormalizedEditorTableSpec): string {
  const cells = spec.columns.map((column) => emitHeaderCell(spec, column));
  if (spec.multiEdit.enabled) {
    cells.unshift(`<TableHead className="sticky top-0 z-20 w-12 min-w-12 max-w-12 bg-muted px-2 py-2 text-center align-middle">
  <div className="flex justify-center">
    <Checkbox
      aria-label="Chọn tất cả dòng"
      checked={
        fields.length > 0 &&
        (selectedRowIds.length === fields.length ||
          (selectedRowIds.length > 0 && 'indeterminate'))
      }
      disabled={fields.length === 0}
      size="sm"
      onCheckedChange={(checked) => handleSelectAllRows(!!checked)}
    />
  </div>
</TableHead>`);
  }
  if (spec.reorder.enabled) {
    cells.unshift(
      `<TableHead className="sticky top-0 z-20 bg-muted ${spec.reorder.widthClass} px-2 py-2 text-center align-middle">${spec.reorder.header}</TableHead>`,
    );
  }
  if (hasRowActions(spec)) {
    cells.push(
      emitHeaderCell(
        spec,
        {
          kind: 'index',
          header: spec.actions.header ?? '',
          widthClass: spec.actions.widthClass,
        },
        true,
      ),
    );
  }
  return cells.join('\n');
}

function emitRowPrelude(spec: NormalizedEditorTableSpec): string {
  const computed = spec.columns.filter(
    (
      column,
    ): column is Extract<EditorTableColumnSpec, { kind: 'computedCurrency' }> =>
      column.kind === 'computedCurrency',
  );
  if (computed.length === 0) return '';

  return computed
    .map(
      (column) =>
        `void row;\nconst ${column.id} = 0;\n// TODO(scaffold): replace ${column.id} with the real computed value for this row.`,
    )
    .join('\n');
}

function emitBulkEditSetup(spec: NormalizedEditorTableSpec) {
  const columns = bulkEditableColumns(spec);
  if (!hasMultiEdit(spec)) return '';

  const defaultField = columns[0]?.name;
  const headerDefaults = columns
    .map((column) => `    ${column.name}: '',`)
    .join('\n');
  const cases = columns
    .map((column) => {
      const value =
        column.kind === 'number'
          ? `Number.isNaN(Number(rawValue)) ? 0 : Number(rawValue)`
          : 'rawValue';
      return `    case ${quote(column.name)}:
      return ${value};`;
    })
    .join('\n');
  const bulkSetup =
    columns.length > 0
      ? `  type BulkFieldName = ${bulkFieldUnion(columns)};
  const bulkFields = [
${emitBulkFieldOptions(columns)}
  ] as const;
  const [bulkField, setBulkField] = useState<BulkFieldName>(${quote(defaultField ?? '')});
  const [bulkValue, setBulkValue] = useState('');
  const activeBulkField = bulkFields.find((field) => field.name === bulkField);

  const coerceBulkValue = (fieldName: BulkFieldName, rawValue: string) => {
    switch (fieldName) {
${cases}
    }
  };

  const applyBulkValue = (fieldName: BulkFieldName, rawValue: string) => {
    const value = coerceBulkValue(fieldName, rawValue);
    selectedIndexes.forEach((index) => {
      form.setValue(
        \`${spec.arrayName}.\${index}.\${fieldName}\` as never,
        value as never,
        { shouldDirty: true, shouldValidate: true },
      );
    });
  };

  const handleBulkApply = () => {
    if (selectedIndexes.length === 0) return;
    applyBulkValue(bulkField, bulkValue);
  };`
      : '';
  const headerBulkSetup =
    columns.length > 0 && spec.multiEdit.headerInputs
      ? `  const [headerBulkValues, setHeaderBulkValues] = useState<Record<BulkFieldName, string>>({
${headerDefaults}
  });
  const handleHeaderBulkChange = (fieldName: BulkFieldName, value: string) => {
    setHeaderBulkValues((current) => ({ ...current, [fieldName]: value }));
    if (selectedIndexes.length === 0) return;
    applyBulkValue(fieldName, value);
  };`
      : '';
  const copyHandler =
    spec.multiEdit.actionBar && spec.multiEdit.actions.includes('copy')
      ? `    if (action === 'copy') {
      onCopySelected?.(selectedIndexes.map((index) =>
        form.getValues('${spec.arrayName}')[index] as ${spec.entity},
      ));
      return;
    }
`
      : '';
  const pasteHandler =
    spec.multiEdit.actionBar && spec.multiEdit.actions.includes('paste')
      ? `    if (action === 'paste') {
      onPaste?.();
      return;
    }
`
      : '';
  const deleteHandler =
    spec.multiEdit.actionBar && spec.multiEdit.actions.includes('delete')
      ? `    if (action === 'delete') {
      remove([...selectedIndexes].sort((a, b) => b - a));
      setSelectedRowIds([]);
      return;
    }
`
      : '';
  const editHandler =
    spec.multiEdit.actionBar && columns.length > 0
      ? `    if (action === 'edit') handleBulkApply();`
      : '';
  const actionBarState = spec.multiEdit.actionBar
    ? `  const [selectionAction, setSelectionAction] = useState(${quote(spec.multiEdit.actions[0] ?? 'copy')});`
    : '';
  const actionBarHandler = spec.multiEdit.actionBar
    ? `  const handleSelectionAction = (action: string) => {
${copyHandler}${pasteHandler}${deleteHandler}${editHandler}
  };`
    : '';

  return `
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
${actionBarState}
  const selectedIndexes = useMemo(
    () =>
      fields
        .map((field, index) =>
          selectedRowIds.includes(field.fieldId) ? index : null,
        )
        .filter((index): index is number => index !== null),
    [fields, selectedRowIds],
  );
${bulkSetup ? `${bulkSetup}\n` : ''}${headerBulkSetup ? `${headerBulkSetup}\n` : ''}
  const handleSelectAllRows = (checked: boolean) => {
    setSelectedRowIds(checked ? fields.map((field) => field.fieldId) : []);
  };

  const handleSelectRow = (rowId: string, checked: boolean) => {
    setSelectedRowIds((current) =>
      checked
        ? current.includes(rowId)
          ? current
          : [...current, rowId]
        : current.filter((id) => id !== rowId),
    );
  };

${actionBarHandler}
`;
}

function emitPaginationSetup(spec: NormalizedEditorTableSpec) {
  if (!spec.pagination) return '';
  return `
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: ${spec.pagination.pageSize},
  });
  const paginationTable = useReactTable({
    data: fields,
    columns: [],
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { pagination },
    onPaginationChange: setPagination,
  });
  const pageStartIndex = pagination.pageIndex * pagination.pageSize;
  const visibleFields = fields.slice(
    pageStartIndex,
    pageStartIndex + pagination.pageSize,
  );
  useEffect(() => {
    setPagination((current) => {
      const lastPageIndex = Math.max(
        0,
        Math.ceil(fields.length / current.pageSize) - 1,
      );
      return current.pageIndex > lastPageIndex
        ? { ...current, pageIndex: lastPageIndex }
        : current;
    });
  }, [fields.length]);
`;
}

function emitBulkActionBar(spec: NormalizedEditorTableSpec) {
  const columns = bulkEditableColumns(spec);
  const pasteEnabled = spec.multiEdit.actions.includes('paste');
  const actions = spec.multiEdit.actions
    .map((action) => {
      if (action === 'copy') {
        return `...(selectedIndexes.length > 0 && onCopySelected ? [{ value: 'copy', label: intl.formatMessage({ id: 'editorTable.selection.copy' }), icon: 'copy' }] : []),`;
      }
      if (action === 'paste') {
        return `...(clipboardCount > 0 && onPaste ? [{ value: 'paste', label: intl.formatMessage({ id: 'editorTable.selection.paste' }), icon: 'paste' }] : []),`;
      }
      return `...(selectedIndexes.length > 0 ? [{ value: 'delete', label: intl.formatMessage({ id: 'editorTable.selection.delete' }), icon: 'delete', destructive: true }] : []),`;
    })
    .join('\n');
  const editAction =
    columns.length > 0
      ? `...(selectedIndexes.length > 0 ? [{ value: 'edit', label: intl.formatMessage({ id: 'editorTable.selection.edit' }), icon: 'edit' }] : []),`
      : '';
  const editControl =
    columns.length > 0
      ? `<>
            <Select
              value={bulkField}
              onValueChange={(value) => {
                setBulkField(value as BulkFieldName);
                setBulkValue('');
              }}
            >
              <SelectTrigger size="md" className="w-[150px]">
                <SelectValue label="Trường" />
              </SelectTrigger>
              <SelectContent>
                {bulkFields.map((field) => (
                  <SelectItem key={field.name} value={field.name}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeBulkField?.kind === 'date' ? (
              ${buildFormFieldControl({
                kind: 'date',
                surface: 'cell',
                valueExpression: 'bulkValue',
                onChangeExpression: 'setBulkValue',
                variant: 'md',
                ariaLabelExpression: quote('Giá trị áp dụng hàng loạt'),
                calendarLabel: 'Chọn giá trị áp dụng hàng loạt',
              })}
            ) : activeBulkField?.kind === 'number' ? (
              ${buildFormFieldControl({
                kind: 'number',
                surface: 'cell',
                valueExpression: 'bulkValue',
                variant: 'md',
                className: 'w-36 text-right tabular-nums',
                ariaLabelExpression: quote('Giá trị áp dụng hàng loạt'),
                onChangeHandlerExpression:
                  '(event) => setBulkValue(event.target.value)',
              })}
            ) : (
              ${buildFormFieldControl({
                kind: 'text',
                surface: 'cell',
                valueExpression: 'bulkValue',
                variant: 'md',
                className: 'w-48',
                ariaLabelExpression: quote('Giá trị áp dụng hàng loạt'),
                onChangeHandlerExpression:
                  '(event) => setBulkValue(event.target.value)',
              })}
            )}
          </>`
      : '';
  const showActionBar = pasteEnabled
    ? 'selectedIndexes.length > 0 || (clipboardCount > 0 && onPaste)'
    : 'selectedIndexes.length > 0';
  const emptySelectionLabel = pasteEnabled
    ? "intl.formatMessage({ id: 'editorTable.selection.clipboardReady' }, { count: clipboardCount })"
    : "''";
  const applyDisabled = pasteEnabled
    ? 'selectedIndexes.length === 0 && (!onPaste || clipboardCount === 0)'
    : 'selectedIndexes.length === 0';
  const extraControlProp =
    columns.length > 0
      ? "extraControl={selectionAction === 'edit' ? " + editControl + ' : null}'
      : '';

  return `      {(${showActionBar}) && (
        <SelectionActionBar
          ariaLabel={intl.formatMessage({ id: 'editorTable.selection.toolbar' })}
          selectionLabel={
            selectedIndexes.length > 0
              ? intl.formatMessage(
                  { id: 'editorTable.selection.selected' },
                  { count: selectedIndexes.length },
                )
              : ${emptySelectionLabel}
          }
          actionLabel={intl.formatMessage({ id: 'editorTable.selection.action' })}
          actionPlaceholder={intl.formatMessage({ id: 'editorTable.selection.chooseAction' })}
          actions={([
${actions}
${editAction}
          ]) as SelectionActionOption[]}
          action={selectionAction}
          onActionChange={(value) => {
            setSelectionAction(value);
${columns.length > 0 ? "            setBulkValue('');" : ''}
          }}
          applyLabel={intl.formatMessage({ id: 'editorTable.selection.apply' })}
          onApply={handleSelectionAction}
          applyDisabled={${applyDisabled}}
          onClear={
            selectedIndexes.length > 0 ? () => setSelectedRowIds([]) : undefined
          }
          clearLabel={intl.formatMessage({ id: 'editorTable.selection.clear' })}
          ${extraControlProp}
        />
      )}`;
}

function emitCells(spec: NormalizedEditorTableSpec): string {
  const cells = spec.columns.map((column) => {
    if (column.kind === 'index') {
      return `<TableCell className="px-4 py-2 text-muted-foreground">
  {index + 1}
</TableCell>`;
    }
    if (column.kind === 'computedCurrency') return computedCell(column);
    if (column.kind === 'custom') return customCell(column);
    return editableCell(spec, column);
  });

  if (spec.multiEdit.enabled) {
    cells.unshift(`<TableCell className="w-12 min-w-12 max-w-12 px-2 py-2 text-center align-middle">
  <div className="flex justify-center">
    <Checkbox
      aria-label={\`Chọn dòng \${index + 1}\`}
      checked={selectedRowIds.includes(field.fieldId)}
      size="sm"
      onCheckedChange={(checked) => handleSelectRow(field.fieldId, !!checked)}
    />
  </div>
</TableCell>`);
  }

  if (hasRowActions(spec)) {
    const actionButtons: string[] = [];
    if (spec.actions.duplicate) {
      actionButtons.push(`    <Button
      aria-label={\`Nhân đôi dòng \${index + 1}\`}
      title="Nhân đôi"
      type="button"
      variant="ghost"
      mode="icon"
      size="sm"
      onClick={() => handleDuplicateRow(index)}
    >
      <Copy />
    </Button>`);
    }
    if (spec.actions.insert) {
      actionButtons.push(`    <Button
      aria-label={\`Thêm dòng dưới dòng \${index + 1}\`}
      title="Thêm dòng dưới"
      type="button"
      variant="ghost"
      mode="icon"
      size="sm"
      onClick={() => handleAddRowBelow(index)}
    >
      <Plus />
    </Button>`);
    }
    if (spec.actions.delete) {
      actionButtons.push(`    <Button
      aria-label={\`Xóa dòng \${index + 1}\`}
      title="Xóa"
      type="button"
      variant="destructive"
      appearance="ghost"
      mode="icon"
      size="sm"
      onClick={() => ${spec.pagination ? 'handleDeleteRow(index)' : 'remove(index)'}}
    >
      <Trash2 />
    </Button>`);
    }
    cells.push(`<TableCell className="sticky right-0 z-10 bg-card px-3 py-2 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">
  <div className="flex justify-end gap-1">
${actionButtons.join('\n')}
  </div>
</TableCell>`);
  }

  return cells.join('\n');
}

function emitReorderCell(spec: NormalizedEditorTableSpec): string {
  return `<TableCell className="${spec.reorder.widthClass} px-2 py-2 text-center align-middle">
  <Button
    type="button"
    variant="ghost"
    mode="icon"
    size="sm"
    aria-label={\`Kéo để sắp xếp dòng \${index + 1}\`}
    title="Kéo để sắp xếp"
    {...sortable.attributes}
    {...sortable.listeners}
  >
    <GripVertical />
  </Button>
</TableCell>`;
}

function hasRowActions(spec: NormalizedEditorTableSpec): boolean {
  return (
    spec.actions.enabled &&
    (spec.actions.duplicate || spec.actions.insert || spec.actions.delete)
  );
}

function hasEditableColumn(spec: NormalizedEditorTableSpec): boolean {
  return spec.columns.some(
    (column) =>
      column.kind === 'text' ||
      column.kind === 'number' ||
      column.kind === 'date' ||
      column.kind === 'autocomplete',
  );
}

function hasComputedColumn(spec: NormalizedEditorTableSpec): boolean {
  return spec.columns.some((column) => column.kind === 'computedCurrency');
}

function hasPlainInputColumn(spec: NormalizedEditorTableSpec): boolean {
  return spec.columns.some(
    (column) =>
      (column.kind === 'text' && column.inputType !== 'password') ||
      (column.kind === 'number' &&
        (!column.format || column.format === 'plain')),
  );
}

function hasAutocompleteColumn(spec: NormalizedEditorTableSpec): boolean {
  return spec.columns.some((column) => column.kind === 'autocomplete');
}

function emitAutocompleteOptionConsts(spec: NormalizedEditorTableSpec): string {
  return spec.columns
    .filter((column) => column.kind === 'autocomplete')
    .map((column) => {
      const rows = column.options
        .map(
          (option) =>
            `  { value: ${quote(option.value)}, label: ${quote(option.label)} },`,
        )
        .join('\n');
      return `const ${column.name}Options: AutocompleteOption[] = [\n${rows}\n];`;
    })
    .join('\n\n');
}

function hasPasswordColumn(spec: NormalizedEditorTableSpec): boolean {
  return spec.columns.some(
    (column) => column.kind === 'text' && column.inputType === 'password',
  );
}

function hasFormattedNumberColumn(spec: NormalizedEditorTableSpec): boolean {
  return spec.columns.some(
    (column) =>
      column.kind === 'number' &&
      column.format !== undefined &&
      column.format !== 'plain',
  );
}

function hasDateColumn(spec: NormalizedEditorTableSpec): boolean {
  return spec.columns.some((column) => column.kind === 'date');
}

function hasMultiEdit(spec: NormalizedEditorTableSpec): boolean {
  return spec.multiEdit.enabled;
}

/**
 * Import only what the emitted cells actually use — `noUnusedLocals` makes any
 * unused import a build error, so the icons, RHF `Controller`, `Input` and
 * `formatCurrencyVND` are gated on the column kinds / actions present.
 */
function emitImports(spec: NormalizedEditorTableSpec): string {
  const editable = hasEditableColumn(spec);
  const computed = hasComputedColumn(spec);
  const plainInput = hasPlainInputColumn(spec);
  const autocomplete = hasAutocompleteColumn(spec);
  const password = hasPasswordColumn(spec);
  const formattedNumber = hasFormattedNumberColumn(spec);
  const date = hasDateColumn(spec);
  const multiEdit = hasMultiEdit(spec);
  const hasBulkFields = bulkEditableColumns(spec).length > 0;
  const pagination = Boolean(spec.pagination);
  const toolbarShortcut = Boolean(spec.toolbar?.addShortcut);
  const icons = [
    ...(hasRowActions(spec) && spec.actions.duplicate ? ['Copy'] : []),
    ...(hasRowActions(spec) && spec.actions.insert ? ['Plus'] : []),
    ...(hasRowActions(spec) && spec.actions.delete ? ['Trash2'] : []),
    'Plus',
    ...(spec.reorder.enabled ? ['GripVertical'] : []),
  ].filter((icon, index, all) => all.indexOf(icon) === index);
  const rhfValues = editable ? 'Controller, useFieldArray' : 'useFieldArray';

  const lines = [
    ...(multiEdit && spec.multiEdit.actionBar
      ? ["import { useIntl } from 'react-intl';"]
      : []),
    ...(spec.toolbar || spec.reorder.enabled
      ? ["import type { ReactNode } from 'react';"]
      : []),
    ...(toolbarShortcut
      ? ["import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip';"]
      : []),
    ...(multiEdit || pagination
      ? [
          `import { ${[
            ...(pagination ? ['useEffect'] : []),
            ...(multiEdit ? ['useMemo'] : []),
            'useState',
          ].join(', ')} } from 'react';`,
        ]
      : []),
    ...(icons.length > 0
      ? [`import { ${icons.join(', ')} } from 'lucide-react';`]
      : []),
    `import { ${rhfValues} } from 'react-hook-form';`,
    "import type { UseFormReturn } from 'react-hook-form';",
    "import { Button } from '@/components/ui/button';",
  ];
  if (spec.reorder.enabled) {
    lines.push(
      "import {\n  DndContext,\n  KeyboardSensor,\n  PointerSensor,\n  closestCenter,\n  useSensor,\n  useSensors,\n  type DragEndEvent,\n} from '@dnd-kit/core';",
      "import {\n  SortableContext,\n  sortableKeyboardCoordinates,\n  useSortable,\n  verticalListSortingStrategy,\n} from '@dnd-kit/sortable';",
      "import { CSS } from '@dnd-kit/utilities';",
    );
  }
  if (multiEdit)
    lines.push("import { Checkbox } from '@/components/ui/checkbox';");
  if (multiEdit && spec.multiEdit.actionBar) {
    lines.push(
      "import { SelectionActionBar } from '@/components/ui/selection-action-bar';",
      "import type { SelectionActionOption } from '@/components/ui/selection-action-bar';",
    );
  }
  if (pagination) {
    lines.push(
      "import { getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';",
      "import type { PaginationState } from '@tanstack/react-table';",
      "import { DataGridProvider } from '@/components/ui/data-grid';",
      "import { DataGridPagination } from '@/components/ui/data-grid-pagination';",
    );
  }
  if (plainInput || (multiEdit && hasBulkFields))
    lines.push("import { Input } from '@/components/ui/input';");
  if (autocomplete) {
    lines.push(
      "import { AutocompleteInput } from '@/components/ui/autocomplete-input';",
    );
    lines.push(
      "import type { AutocompleteOption } from '@/components/ui/autocomplete-input';",
    );
  }
  if (password)
    lines.push(
      "import { PasswordInput } from '@/components/ui/password-input';",
    );
  if (formattedNumber)
    lines.push(
      "import { NumericInput } from '@/components/ui/inputs/numeric-input';",
    );
  if (date)
    lines.push(
      "import { DatePickerInput } from '@/components/ui/inputs/date-picker-input';",
    );
  if (multiEdit && hasBulkFields)
    lines.push(
      "import {\n  Select,\n  SelectContent,\n  SelectItem,\n  SelectTrigger,\n  SelectValue,\n} from '@/components/ui/select';",
    );
  lines.push(
    "import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';",
  );
  lines.push(
    "import {\n  TableBody,\n  TableCell,\n  TableHead,\n  TableHeader,\n  TableRow,\n} from '@/components/ui/table';",
  );
  if (editable) {
    lines.push(
      "import {\n  Tooltip,\n  TooltipContent,\n  TooltipTrigger,\n} from '@/components/ui/tooltip';",
    );
  }
  if (computed) lines.push("import { formatCurrencyVND } from '@/lib/format';");
  lines.push(`import type { ${spec.entity} } from ${quote(spec.modelImport)};`);
  lines.push(
    `import type { ${spec.valuesType} } from ${quote(spec.valuesImport)};`,
  );
  return lines.join('\n');
}

export function buildEditorTableModule(input: EditorTableSpec): string {
  const spec = editorTableSpecSchema.parse(input);
  const componentName =
    spec.componentName ?? `${pascalCase(spec.entity)}EditorTable`;
  const createRowProp = spec.createRowProp ?? 'createRow';
  const multiEdit = hasMultiEdit(spec);
  const actionBarProps =
    multiEdit && spec.multiEdit.actionBar
      ? [
          ...(spec.multiEdit.actions.includes('copy')
            ? [`onCopySelected?: (rows: ${spec.entity}[]) => void;`]
            : []),
          ...(spec.multiEdit.actions.includes('paste')
            ? ['clipboardCount?: number;', 'onPaste?: () => void;']
            : []),
        ].join('\n  ')
      : '';
  const actionBarDestructuring =
    multiEdit && spec.multiEdit.actionBar
      ? [
          ...(spec.multiEdit.actions.includes('copy')
            ? ['onCopySelected']
            : []),
          ...(spec.multiEdit.actions.includes('paste')
            ? ['clipboardCount = 0', 'onPaste']
            : []),
        ].join(',\n  ')
      : '';
  const columnCount =
    spec.columns.length +
    (hasRowActions(spec) ? 1 : 0) +
    (spec.reorder.enabled ? 1 : 0) +
    (multiEdit ? 1 : 0);
  const rowPrelude = emitRowPrelude(spec);
  const bulkEditSetup = emitBulkEditSetup(spec);
  const paginationSetup = emitPaginationSetup(spec);
  const scrollClass = scrollAreaClass(spec);
  const scrollAreaOpen = scrollClass
    ? `<ScrollArea type="always" className="${scrollClass}" viewportClassName="h-full min-w-0 overflow-y-auto">`
    : '<ScrollArea type="always">';

  // Gate row-action plumbing on `actions.enabled` and the per-row `errors`
  // binding on having an editable column — `noUnusedLocals` rejects either if
  // emitted but unused.
  const fieldArrayOperations = ['fields', 'append'];
  if (hasRowActions(spec) && (spec.actions.duplicate || spec.actions.insert)) {
    fieldArrayOperations.push('insert');
  }
  if (hasRowActions(spec) && spec.actions.delete) {
    fieldArrayOperations.push('remove');
  }
  if (
    hasMultiEdit(spec) &&
    spec.multiEdit.actions.includes('delete') &&
    !fieldArrayOperations.includes('remove')
  ) {
    fieldArrayOperations.push('remove');
  }
  if (spec.reorder.enabled) fieldArrayOperations.push('move');
  const fieldArrayBindings = fieldArrayOperations.join(', ');
  const actionHandlerLines: string[] = [];
  if (hasRowActions(spec) && spec.actions.insert) {
    actionHandlerLines.push(`  const handleAddRowBelow = (index: number) => {
    ${
      spec.pagination
        ? `const insertIndex = index + 1;
    insert(insertIndex, ${createRowProp}());`
        : `insert(index + 1, ${createRowProp}());`
    }${
      spec.pagination
        ? `
    setPagination((current) => ({
      ...current,
      pageIndex: Math.floor(insertIndex / current.pageSize),
    }));`
        : ''
    }
  };
`);
  }
  if (hasRowActions(spec) && spec.actions.duplicate) {
    actionHandlerLines.push(`  const handleDuplicateRow = (index: number) => {
    const currentRow = form.getValues(\`${spec.arrayName}.\${index}\`);
    ${
      spec.pagination
        ? `const insertIndex = index + 1;
    insert(insertIndex, { ...currentRow, id: crypto.randomUUID() });`
        : `insert(index + 1, { ...currentRow, id: crypto.randomUUID() });`
    }${
      spec.pagination
        ? `
    setPagination((current) => ({
      ...current,
      pageIndex: Math.floor(insertIndex / current.pageSize),
    }));`
        : ''
    }
  };
`);
  }
  if (spec.pagination && hasRowActions(spec) && spec.actions.delete) {
    actionHandlerLines.push(`  const handleDeleteRow = (index: number) => {
    remove(index);
    setPagination((current) => {
      const lastPageIndex = Math.max(
        0,
        Math.ceil((fields.length - 1) / current.pageSize) - 1,
      );
      return current.pageIndex > lastPageIndex
        ? { ...current, pageIndex: lastPageIndex }
        : current;
    });
  };
`);
  }
  const actionHandlers = actionHandlerLines.join('\n\n');
  const reorderHandlers = spec.reorder.enabled
    ? `
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((field) => field.fieldId === active.id);
    const newIndex = fields.findIndex((field) => field.fieldId === over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    move(oldIndex, newIndex);
  };
`
    : '';
  const errorsLine = hasEditableColumn(spec)
    ? `\n              const errors = form.formState.errors.${spec.arrayName}?.[index];`
    : '';
  const visibleFieldsName = spec.pagination ? 'visibleFields' : 'fields';
  const rowMapExpression = spec.pagination
    ? `${visibleFieldsName}.map((field, pageOffset) => {
              const index = pageStartIndex + pageOffset;`
    : `${visibleFieldsName}.map((field, index) => {`;

  // Optional self-contained toolbar (title + row count + add button) driven by
  // the component's own `fields` / `handleAddRow`, so a consumer never needs a
  // second `useFieldArray` to add rows.
  const toolbar = spec.toolbar;
  const toolbarTitle = toolbar?.titleProp
    ? `{${toolbar.titleProp} ?? ${quote(toolbar.title)}}`
    : toolbar
      ? toolbar.title
      : '';
  const toolbarActions = toolbar
    ? toolbar.contentPosition === 'afterAdd'
      ? `${toolbar.addShortcut ? `          <ShortcutTooltip label=${quote(toolbar.addLabel)} shortcut=${quote(toolbar.addShortcut)}>` : ''}
          <Button type="button" variant="${toolbar.addVariant}"${toolbar.addShortcut ? ' data-shortcut-action="create"' : ''} onClick={handleAddRow}>
            <Plus />
            ${toolbar.addLabel}
          </Button>
          ${toolbar.addShortcut ? '        </ShortcutTooltip>' : ''}
          {toolbarContent}`
      : `          {toolbarContent}
          ${toolbar.addShortcut ? `          <ShortcutTooltip label=${quote(toolbar.addLabel)} shortcut=${quote(toolbar.addShortcut)}>` : ''}
          <Button type="button" variant="${toolbar.addVariant}"${toolbar.addShortcut ? ' data-shortcut-action="create"' : ''} onClick={handleAddRow}>
            <Plus />
            ${toolbar.addLabel}
          </Button>` +
        (toolbar.addShortcut ? '\n        </ShortcutTooltip>' : '')
    : '';
  const toolbarOpen = toolbar
    ? `    <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
    <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">${toolbarTitle}</h2>
          <div className="text-xs text-muted-foreground">{fields.length} dòng</div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
${toolbarActions}
        </div>
      </div>
`
    : '';
  const toolbarClose = toolbar ? `    </div>\n` : '';
  const bulkActionBar =
    multiEdit && spec.multiEdit.actionBar ? `\n${emitBulkActionBar(spec)}` : '';
  const paginationFooter = spec.pagination
    ? `      {fields.length > 0 ? (
        <div className="shrink-0 border-t border-border px-4 py-2">
        <DataGridPagination
          sizes={[${spec.pagination.sizes.join(', ')}]}
          sizesDescription="dòng"
          info="{from} - {to} / {count} dòng"
        />
        </div>
      ) : null}
`
    : '';
  const returnFragment = Boolean(
    bulkActionBar || (spec.pagination && !toolbar),
  );
  const returnOpen = returnFragment
    ? `    <>\n${toolbarOpen}      ${scrollAreaOpen}`
    : `${toolbarOpen}    ${scrollAreaOpen}`;
  const returnClose = `${paginationFooter}${toolbarClose}${bulkActionBar}${
    returnFragment ? '\n    </>' : ''
  }`;

  const sortableRow = spec.reorder.enabled
    ? `
function ${componentName}SortableRow({
  id,
  renderCells,
}: {
  id: string;
  renderCells: (sortable: ReturnType<typeof useSortable>) => ReactNode;
}) {
  const sortable = useSortable({ id });
  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <TableRow
      ref={sortable.setNodeRef}
      style={style}
      data-dragging={sortable.isDragging || undefined}
      hoverable={false}
    >
      {renderCells(sortable)}
    </TableRow>
  );
}
`
    : '';

  const body = `${sortableRow}
interface ${componentName}Props {
  form: UseFormReturn<${spec.valuesType}>;
  ${createRowProp}: () => ${spec.entity};
  ${actionBarProps}
  ${toolbar ? 'toolbarContent?: ReactNode;' : ''}
  ${toolbar?.titleProp ? `${toolbar.titleProp}?: ReactNode;` : ''}
}

export function ${componentName}({
  form,
  ${createRowProp},
  ${actionBarDestructuring ? `${actionBarDestructuring},` : ''}
  ${toolbar ? 'toolbarContent,' : ''}
  ${toolbar?.titleProp ? `${toolbar.titleProp},` : ''}
}: ${componentName}Props) {
  const { ${fieldArrayBindings} } = useFieldArray({
    control: form.control,
    name: '${spec.arrayName}',
    keyName: 'fieldId',
  });
  const watchedRows = form.watch('${spec.arrayName}') ?? [];
  ${multiEdit && spec.multiEdit.actionBar ? 'const intl = useIntl();' : ''}

  const handleAddRow = () => {
    append(${createRowProp}());${
      spec.pagination
        ? `
    setPagination((current) => ({
      ...current,
      pageIndex: Math.floor(fields.length / current.pageSize),
    }));`
        : ''
    }
  };
${actionHandlers ? `\n${actionHandlers}` : ''}${reorderHandlers}${bulkEditSetup}${paginationSetup}
  return (
${spec.pagination ? `    <DataGridProvider table={paginationTable} recordCount={fields.length}>\n` : ''}
${returnOpen}
      <div className="${spec.tableMinWidthClass}">
${
  spec.reorder.enabled
    ? `        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={${visibleFieldsName}.map((field) => field.fieldId)}
            strategy={verticalListSortingStrategy}
          >
`
    : ''
}        <table className="w-full caption-bottom text-foreground text-sm">
        <TableHeader>
          <TableRow>
${indent(emitHeaders(spec), 12)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.length === 0 ? (
            <TableRow hoverable={false}>
              <TableCell colSpan={${columnCount}} className="h-28 text-center">
                <div className="flex flex-col items-center gap-3">
                  <span className="text-muted-foreground">Chưa có dữ liệu</span>
                  <Button type="button" variant="outline" onClick={handleAddRow}>
                    <Plus />
                    Thêm dòng
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            ${rowMapExpression}
              const row = watchedRows[index] as ${spec.entity} | undefined;${errorsLine}
${rowPrelude ? indent(rowPrelude, 14) : '              void row;'}

${
  spec.reorder.enabled
    ? `              return (
                <${componentName}SortableRow
                  key={field.fieldId}
                  id={field.fieldId}
                  renderCells={(sortable) => (
                    <>
${indent(emitReorderCell(spec), 22)}
${indent(emitCells(spec), 22)}
                    </>
                  )}
                />
              );`
    : `              return (
                <TableRow key={field.fieldId} hoverable={false}>
${indent(emitCells(spec), 18)}
                </TableRow>
              );`
}
            })
          )}
        </TableBody>
        </table>
${
  spec.reorder.enabled
    ? `        </SortableContext>
        </DndContext>`
    : ''
}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
${returnClose}
${spec.pagination ? '    </DataGridProvider>\n' : ''}
  );
}`;

  const autocompleteOptions = emitAutocompleteOptionConsts(spec);
  return `${banner(spec.specPath)}\n${emitImports(spec)}${autocompleteOptions ? `\n\n${autocompleteOptions}` : ''}\n\n${body}\n`;
}
