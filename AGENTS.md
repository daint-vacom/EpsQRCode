# Agent Instructions

This project is a Metronic 9 React starter template being adapted into a reusable Vietnamese web/admin template. Keep this file as runtime policy, not project history.

## Token Budget / Doc Loading Policy

Do not read every project document by default. Start from current code and this file, then read only the narrowest relevant docs or sections. Prefer `rg` and targeted excerpts over full-file reads for large docs.

Doc routing:

- `docs/00-stack-and-architecture.md` — stack, versions, app foundation. Consult when architecture or setup is unclear.
- `docs/06-component-usage-guide.md` — UI primitive/component usage. Read only when no builder matches, a custom primitive is needed, or shared component behavior/styling changes.
- `docs/workflows/implement-ui.md` + `src/builders/README.md` — UI workflow and builder registry. Read when a page/surface may be generated, then open only the matching builder guide.
- `docs/01-coding-convention.md` — targeted sections for naming, feature structure, TypeScript, forms, routing, or imports.
- `docs/02-design-system.md` — targeted sections for dense Vietnamese admin UX, tables, forms, dialogs, copy, and interaction behavior.
- `docs/permissions/overview.md` — only for auth, RBAC, permissions, route guards, menu filtering, or admin role screens; then read one focused permission guide.

Builder fast path:

- For ordinary builder-supported UI implementation, load only `.codex/skills/use-builder/SKILL.md`, `docs/workflows/implement-ui.md`, `src/builders/README.md`, the matching `docs/builders/*` guide, and relevant feature code/tests.
- Do not load graph/codebase-map skills, broad design/polish skills, `docs/components/*`, `docs/06-component-usage-guide.md`, `docs/02-design-system.md`, `docs/reference/*`, or `docs/engineering/*` unless the request exposes that specific need.
- Do not start browser/live preview for standard generated UI when targeted tests and `npm run build` cover the behavior. Use it only for unresolved layout, responsive, overlay, shared styling, or manual interaction risk.
- Skip `brainstorming` and `test-driven-development` process skills for ordinary builder fast-path UI work. The workflow checklist and matching builder guide already define behavior and tests. Reach for them only when requirements are genuinely ambiguous or the change is non-builder logic.

Current code, `package.json`, and `docs/00-stack-and-architecture.md` win over older doc examples.

## Stack Snapshot

- Vite, React 19, TypeScript, React Router 7 declarative routes, Tailwind CSS 4 via `@tailwindcss/vite`.
- Alias `@/*` maps to `src/*`.
- Shared UI primitives live in `src/components/ui`.
- Existing Metronic `layout-*` files keep their layout-first structure; do not relocate them just to match docs.
- New domain work should be feature-first (`src/features/<domain>/...`) unless working inside `src/examples/`.

## UI Implementation Rules

- Before implementing any page, feature screen, repeated UI surface, or generated scaffold candidate, always use `.codex/skills/use-builder/SKILL.md`. Follow `docs/workflows/implement-ui.md`; the registry decides which builder guide and command apply. This builder gate is the default route for UI work and should stay narrower than broad architecture/design exploration.
- Preserve Metronic component behavior unless the task explicitly asks to replace it.
- Favor dense, desktop-admin layouts over marketing-style pages.
- Build actual working screens, not landing pages, when asked for an app/template feature.
- Tables should support sticky headers, fixed action columns, loading/empty states, pagination, and permission-aware actions when relevant.
- Forms should use Vietnamese validation copy, clear required markers, compact spacing, and predictable tab order.
- Prefer Lucide icons when a matching icon exists. Keep icon-only controls to familiar actions or provide accessible labels/tooltips.
- Reuse `src/components/ui` before creating new base components.
- Style shared admin defaults at the component/token root, not with per-page class patches. See `docs/06-component-usage-guide.md` when changing shared look.

## Import and Runtime Symbol Rules

- When adding or renaming a JSX component, hook, icon, helper, or type, update its import in the same patch. Do not rely on Vite HMR or a previous import being present in a nearby file.
- Before browser verification, run `npx tsc --noEmit` after the final code edit. A passing build from an earlier intermediate state does not count.
- For every newly referenced symbol in a changed file, verify that it is either locally declared or imported from its real module. Use targeted `rg` searches when needed; specifically check UI wrappers such as `Tooltip`, `ShortcutTooltip`, dialogs, form fields, and icons.
- Run the focused undefined-symbol check on changed TypeScript files: `npm run lint:imports -- path/to/changed-file.tsx`. This intentionally enables ESLint `no-undef` only for the supplied files because the legacy template has unrelated baseline lint errors across the full source tree.
- If a runtime `ReferenceError` occurs, fix the missing import first, then reload the route and rerun TypeScript plus the focused test/build checks before continuing with visual verification.
- Generated UI output remains subject to the same import checks after regeneration or manual scaffold-and-own reconciliation.

## Database Migration Rules

- Remote Supabase migrations should be applied through a direct PostgreSQL connection using `SUPABASE_DB_URL` from `.env.development.local`; do not assume `supabase db push` is the working path for this project.
- Never print the connection string or password. When the password contains reserved URL characters such as `@`, percent-encode it before constructing the driver connection string.
- Before applying, query `supabase_migrations.schema_migrations` and confirm the target migration version is not already recorded. Apply the requested migration in a transaction, then record its version only after the SQL commits successfully.
- The direct `db.<project>.supabase.co` endpoint may be IPv6-only. If the current machine has no IPv6 route, derive the Supavisor session-pooler endpoint from the same project (port `5432`) and reuse the credentials from `SUPABASE_DB_URL`; do not modify `.env` unless explicitly requested.
- Verify the result after applying: migration history, expected tables/views/columns, relevant storage bucket settings, and any seeded records. Report unrelated pending migrations separately instead of silently applying them.

## Verification

Before claiming work is complete, run the narrowest useful checks:

- `npm run build` for TypeScript and production build validation.
- Targeted tests for changed behavior; broader `npm run test:run` only when the blast radius justifies it.
- `npm run lint` only when its auto-fix behavior is acceptable for the changed files.
- For UI changes, prefer automated tests and focused DOM/assertion checks first.
- Run browser/live preview only when visual layout, responsive behavior, shared styling, modals/popovers, or user-facing interaction cannot be trusted from tests alone.
- Browser checks should be narrow: open the route, perform the relevant interaction, inspect console/errors, and avoid full DOM dumps or screenshots unless visual judgment is required.
- Check both 1366px and 1920px only for layout/restyle/shared component changes or when the task explicitly requires viewport parity.
