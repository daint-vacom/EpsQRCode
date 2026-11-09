# Dialog builder

Use the dialog builder for standard modal chrome whose feature-specific content is composed by the
caller. The spec owns the title, optional description, width, and footer actions. The generated
component receives `children` for the body and callback props for each configured action.

The shared dialog content already renders a close icon in the header. Do not add a redundant
"Đóng" action to the footer. Configure only workflow actions there, such as Next, Back, Save, or
Export. For dialogs with step-dependent footer actions, use the generated `footer` slot; set
`actions: []` when the feature owns the footer. With `actions: []`, the footer is omitted while
the slot is empty.

Create a fixture and generate the shell:

```bash
npm run gen:dialog -- <spec.ts> <out.tsx>
```

The generated dialog uses the shared spacing contract used by the existing form dialogs:

- content: `p-0`, `gap-0`, and a column layout;
- header: `px-6 py-5`;
- body: `px-6 py-5` with a bounded scroll area;
- footer: `px-6 py-4`.

Supported widths are `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, and `5xl`.

This builder is for dialog chrome, not create/edit form behavior. Use `form-builder` when the dialog
is a reusable RHF + zod create/edit form.
