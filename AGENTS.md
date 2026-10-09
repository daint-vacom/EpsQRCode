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
- Every page, new or existing, must provide the three standard UI states: **Idle**, **loading**, and **error**. Idle is the normal loaded view, including a deliberate empty state when there is no data. Loading communicates that the page data is being fetched without replacing the page's location/navigation context. Error explains that loading failed and provides a relevant retry or recovery action when available. Do not use page-specific loading copy such as “Đang tải dữ liệu” as the only loading treatment; keep the shared page structure and use a concise, consistent loading state.
- Use the shared `ErrorState` for data-load failures. Its placement depends on the failed data: a page-wide error is only for a detail page centered on one object when that object's core data failed to load. Errors from an independent tab, section, or UI cluster stay within that area; dashboard errors are always local to the affected cluster. Use real, actionable error content rather than test or preview copy. `ErrorState` renders no card or surface of its own: place it directly on the page background or in the content area of an existing parent card, and do not wrap it in another card. Keep the toolbar and static section/card headings visible; see `docs/components/error-state.md`.
- Keep the page toolbar visible in Idle, loading, and error states. Do not hide the toolbar while loading or after an error; users must retain the page context and a way to navigate back.
- Detail pages use a page toolbar with a back button styled as a ghost action. Place the page icon and title next to it. Before data is available, show the stable default title (for example, “Chi tiết vật tư”); after data loads, replace it with the record's real title (for example, “Vật tư ABC”). Show primary record actions on the right only after the record data is available. Apply this layout to new detail pages; do not treat it as a requirement to redesign every existing detail page in unrelated work.
- When working on an existing page, check whether its three UI states and persistent toolbar follow these rules. If a state is missing or inconsistent, call it out and propose the focused addition; expand the work to a broader legacy-page audit only when that scope is confirmed.
- Preserve Metronic component behavior unless the task explicitly asks to replace it.
- Favor dense, desktop-admin layouts over marketing-style pages.
- Build actual working screens, not landing pages, when asked for an app/template feature.
- Tables should support sticky headers, fixed action columns, loading/empty states, pagination, and permission-aware actions when relevant.
- Forms should use Vietnamese validation copy, clear required markers, compact spacing, and predictable tab order.
- Do not use placeholder text on text or textarea inputs in create/edit forms unless the user explicitly requests it. Use the visible field label to identify the input.
- Prefer Lucide icons when a matching icon exists. Keep icon-only controls to familiar actions or provide accessible labels/tooltips.
- Set Button loading labels to concise copy without trailing dots or an ellipsis (for example, `Đang lưu`). The spinner already communicates the loading state; apply this to every `loadingText`.
- Buttons rendered in `PageHeader` actions must explicitly use `size="md"`.
- Reuse `src/components/ui` before creating new base components.
- Before adding an input or selector, search the shared UI and feature components for the same behavior. Reuse the matching component or wrap it in a focused domain component instead of recreating its markup or styling inline. Add a specialized selector only when existing components do not cover its domain behavior or presentation.
- Before adding or changing static UI copy, search `src/i18n/messages/vi.ts` for an existing message ID and reuse it for the same concept. For new copy, add the message ID to both Vietnamese and English catalogs; keep dynamic business data and user-authored content outside the catalogs.
- List pages use `DataGridHeader` to place search and filters on the left and table actions on the right. Keep the table footer to the shared `DataGridPagination`; do not add a second feature-specific record count beside the page-size selector.
- For new visual patterns that do not yet exist in the web product, do not force-fit an existing component merely for reuse. Design the information hierarchy, interaction, spacing, and visual language first; reuse existing components when they are true shared patterns or preserve important behavior and accessibility. Otherwise, compose a focused local structure and extract it only when the pattern genuinely repeats. Keep new UI purposeful and inventive rather than assembling ornamental wrappers around unrelated primitives.
- Style shared admin defaults at the component/token root, not with per-page class patches. See `docs/06-component-usage-guide.md` when changing shared look.
- Frontend is not a legacy compatibility layer: when a domain or data shape changes, add/update the required migration and backend/read-model contract, then make the frontend consume the canonical new shape only. Do not add legacy-field fallbacks, dual-shape reads, or client-side compatibility conversions unless the user explicitly approves them; compatibility belongs at the server/API boundary when it is required.
- Reuse `tag_groups`, `tags`, and `tag_assignments` for ordinary object grouping and labels (for example, classifying work items). Add a domain-specific table and specialized catalog UI only when the concept needs structured fields, relationships, or workflows that generic tags cannot represent; the target object being different is not by itself a reason to create a separate tag table. Add the required subject-type validation and RLS policies consistent with this repo's non-tenant data model when introducing a new taggable object.

## Import and Runtime Symbol Rules

- When adding or renaming a JSX component, hook, icon, helper, or type, update its import in the same patch. Do not rely on Vite HMR or a previous import being present in a nearby file.
- Before browser verification, run `npx tsc --noEmit` after the final code edit. A passing build from an earlier intermediate state does not count.
- For every newly referenced symbol in a changed file, verify that it is either locally declared or imported from its real module. Use targeted `rg` searches when needed; specifically check UI wrappers such as `Tooltip`, `ShortcutTooltip`, dialogs, form fields, and icons.
- Run the focused undefined-symbol check on changed TypeScript files: `npm run lint:imports -- path/to/changed-file.tsx`. This intentionally enables ESLint `no-undef` only for the supplied files because the legacy template has unrelated baseline lint errors across the full source tree.
- If a runtime `ReferenceError` occurs, fix the missing import first, then reload the route and rerun TypeScript plus the focused test/build checks before continuing with visual verification.
- Generated UI output remains subject to the same import checks after regeneration or manual scaffold-and-own reconciliation.

## Database Migration Rules

- Apply remote Supabase migrations through a PostgreSQL connection using `SUPABASE_DB_URL` from `.env.development.local`. Do not default to the Supabase UI, REST API, or `supabase db push` when the task is to apply one specific migration. `supabase db push` applies every pending migration, so use it only when applying the full pending set is explicitly intended.
- Never print the connection string, password, or derived pooler URL. Read the env value in-process. Passwords in this project may contain `@` and other reserved characters; parse the source URL first, decode the password once, then percent-encode the username/password when constructing a new driver URL. Do not use a naive `-split '@'` parser.
- Always preflight `supabase_migrations.schema_migrations` and confirm the target version is absent before executing SQL. If it is already present, do not reapply the migration.
- The direct `db.<project>.supabase.co:5432` endpoint can be IPv6-only. If the machine has no IPv6 route, `--dns-resolver https` does not make an IPv6-only endpoint reachable; switch to the Supavisor **session** pooler on port `5432`.
- Do not guess a shared pooler host from the region. The pooler cluster index is independent of the region. Confirm the project ref from `SUPABASE_DB_URL`, then discover the project region/connection details with the Supabase project connector when available. For this project, the verified mapping is project ref `zkfyhonqhrgqcxznozoc`, region `ap-southeast-2`, session host `aws-0-ap-southeast-2.pooler.supabase.com`, username `postgres.<project-ref>`, port `5432`. Reconfirm the project ref before using this fallback; never apply to a different project.
- When the Supabase CLI cannot connect to the IPv6 direct endpoint, use a temporary Node `pg` client over the verified session pooler: install with `npm install --no-save --package-lock=false pg`, run an inline script, and uninstall it afterward. The script must open a client, `begin`, execute the migration SQL, insert the migration version into `supabase_migrations.schema_migrations`, `commit`, and `rollback` on any error. Do not create a committed helper or change `.env` for this workaround.
- Verify the result through the same PostgreSQL connection: migration history, expected tables/views/columns, functions/RPCs, relevant storage settings, and seeded records. Report unrelated pending migrations separately instead of silently applying them.

## Default Ordering for List Data

- Apply these defaults to every existing and new Supabase query/RPC that returns a list when the caller has not explicitly requested a sort. An explicit caller sort takes precedence.
- Entity and master-data lists sort by an explicit status priority first: active, then intermediate or pending states, then inactive or stopped. Map enum values with an explicit `CASE`; do not depend on enum or text order. Within each status group, sort the displayed name ascending with the Vietnamese alphabet, case-insensitively. Use the database Vietnamese ICU collation (for example, `lower(display_name) COLLATE "vi-x-icu"`) so all `D` names precede `Đ`, and `Đ` precedes `E`. Add a stable ID tie-breaker.
- Document and ticket lists sort by `created_at DESC` so the newest records appear first, followed by a stable ID tie-breaker.
- Preserve an intentional domain order such as `sort_order`, hierarchy, or a user-selected sort when that order is part of the list's behavior; these are not unspecified defaults. For paginated RPCs, use the same ordering for page selection and the returned JSON array, before applying offset/limit.

## Verification

Before claiming work is complete, run the narrowest useful checks:

- Do not run `npm run build` after every small edit or UI text/style iteration. For changes that are
  already validated in the dev server, prefer the narrowest relevant check (for example focused
  import lint, TypeScript, targeted tests, or a direct browser check). Reserve a production build
  for when a workflow or feature is implemented, a substantial editing session is complete, the
  change touches shared primitives, generated output, dependencies, configuration,
  bundling/runtime behavior, or the user asks for build/release validation. Do not repeat the build
  for every incremental edit within the same workflow unless one of those risk conditions changes.
- Targeted tests for changed behavior; broader `npm run test:run` only when the blast radius justifies it.
- `npm run lint` only when its auto-fix behavior is acceptable for the changed files.
- For UI changes, prefer automated tests and focused DOM/assertion checks first.
- Run browser/live preview only when visual layout, responsive behavior, shared styling, modals/popovers, or user-facing interaction cannot be trusted from tests alone.
- Browser checks should be narrow: open the route, perform the relevant interaction, inspect console/errors, and avoid full DOM dumps or screenshots unless visual judgment is required.
- Check both 1366px and 1920px only for layout/restyle/shared component changes or when the task explicitly requires viewport parity.
