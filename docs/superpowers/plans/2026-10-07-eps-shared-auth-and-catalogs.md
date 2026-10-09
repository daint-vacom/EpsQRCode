# EPS shared authentication and catalogs — Implementation Plan

## Goal

Integrate `EpsQRCode` with the shared EPS identity and read-only catalogs already consumed by `PLEpsClient`:

- Sign in with username/password API and EPS SSO.
- Use the EPS API session cookie for authenticated requests.
- Read employees, departments, teams, positions (chức danh), and areas (chuyên môn) from the EPS API.
- Use one system-wide data scope. Do not add tenant identifiers or tenant filters to these requests and queries.
- Do not create, update, or delete data in `PLEpsClient` through this app.

## Current state and source references

`EpsQRCode` currently has a Supabase password login in `src/features/auth/api/auth.api.ts`, persists bearer/refresh tokens in `src/stores/auth.store.ts`, and configures the shared REST client in `src/lib/axios.ts`. Its employee project reads and mutates tenant-scoped Supabase data in `src/project/employees/api/employees.api.ts`.

`PLEpsClient` provides the behavioral and API reference:

- `src/services/auth.service.ts`: `POST /api/v1/auth/login`, `POST /api/v1/auth/loginnotpass`, `POST /api/v1/auth/refresh-token`, `POST /api/v1/auth/logout`; login and SSO requests use `withCredentials: true`.
- `src/auth/LoginSSO.tsx`, `src/auth/CallbackSSO.tsx`, `src/auth/authConfig.ts`: OIDC redirect and callback flow; callback posts the ID token to `loginnotpass`.
- `src/utilities/axios/server-api.ts`: shared API client sends cookies and optionally supports bearer/refresh sessions.
- `src/services/employee.service.ts`: read employee list through `POST /api/v1/employees/search` and current user through `GET /api/v1/employees/current-user/`.
- `src/services/system.service.ts`: `GET /api/v1/departments`, `GET /api/v1/teams?departmentId=...`, `GET /api/v1/positions`, and `GET /api/v1/areas`.
- `src/hooks/queries/use-employee-query.ts`, `src/hooks/queries/system/use-departments-query.ts`, `use-positions-query.ts`, and `use-areas-query.ts`: existing React Query behavior and query scope.

## Backend architecture recommendation

### Target: one browser-facing QR API, separate service/data ownership

Prefer one API origin from the browser: the QR frontend calls its QR backend/BFF, and that backend calls the EPS core API for authentication and shared read-only catalogs. Keep PLEps/EPS core as the source of truth for identity, employees, departments, teams, positions, and areas. Keep QR-specific business records in a QR-owned database. This gives the QR frontend one auth boundary without making the two applications one business system.

The QR backend should expose QR-owned routes or a small read-only EPS adapter, for example `GET /api/v1/reference/employees`, `GET /api/v1/reference/departments`, `GET /api/v1/reference/teams?departmentId=...`, `GET /api/v1/reference/positions`, and `GET /api/v1/reference/areas`. It may translate the EPS employee-search POST into a QR-facing GET. It must not expose create/update/delete operations for EPS-owned entities.

Use one EPS identity provider. Prefer OIDC authorization-code flow with PKCE or a backend-mediated OIDC flow, then give the browser a QR-host-only HttpOnly session cookie. The QR backend should call EPS core with a supported delegated user token/token exchange or a service identity plus explicit user context and authorization checks. Do not depend on JavaScript sharing an HttpOnly cookie across apps, and do not widen the PLEps cookie domain merely to reuse a session. If current EPS auth only offers the PLEps cookie endpoints, agree on a supported server-to-server/delegation contract before the QR backend proxies those requests.

Keep the QR backend's database separate from PLEps-owned tables. QR records should reference stable EPS IDs, not own a writable copy of employee/catalog rows. Add a QR-owned cache/read projection only if latency/availability requires it; define it as non-authoritative with an explicit refresh policy and minimal copied fields. Keep authorization and tenant-free system-wide scope in the backend contract, not as frontend-supplied tenant IDs.

Treat an EPS ID stored in QR tables as an external logical reference, not a database-enforced foreign key. Validate it through EPS when assigning/changing ownership, index it for QR-side filtering, and require EPS IDs to be stable and never reused. Prefer EPS soft-deactivation over physical deletion. Bulk-resolve names for display; do not make one EPS request per row. If reports must filter by changing EPS attributes (such as the current department of an employee), use an EPS query to resolve IDs for small volumes or a QR-owned read projection/reporting store for larger workloads; do not fetch one QR page and filter it afterward. If reports need historical ownership, store the relevant department ID/name snapshot with the event or effective-dated assignment rather than treating the current EPS name as historical truth.

### Transition: two browser API origins only if needed

If the QR backend cannot yet proxy EPS calls, allow the frontend to use two separately configured clients temporarily: the QR API for QR-owned data and the EPS API for EPS login/catalog reads. Keep distinct API modules, query-key namespaces, and error handling so the temporary split can later move behind the QR backend without changing feature consumers. This is suitable only after confirming browser cookie compatibility, credentialed CORS, and the SSO callback configuration for the deployed origins.

Do not introduce a shared-table database integration as a shortcut. A common physical database server can be acceptable only if each backend still owns separate schemas/tables and neither backend reads or writes the other's tables directly. Since the projects have different business workflows and independent deployments, separate service-owned data boundaries are the safer default.

The frontend still keeps one shared Axios boundary per API origin (one in the target BFF arrangement, two during the transition), typed API functions, source DTO mapping, and React Query hooks. Adapt PLEpsClient behavior to this repo's TanStack Query v5 and API error contract; do not copy PLEpsClient modules wholesale.

## Work sequence

### 1. Agree the service boundary and confirm deployment/API contract

- Decide whether the first release can use the QR backend as BFF or needs the temporary two-origin setup. Confirm QR backend ownership, deployment boundary, and API base URL conventions so `/api/v1` is not duplicated.
- Agree with the EPS backend owner on OIDC/delegation or service-to-service auth and user authorization context. If only cookie login is currently supported, document the required backend contract change before implementation.
- Verify the login and refresh responses establish an HttpOnly cookie, whether refresh is required for cookie sessions, logout behavior, and the employee/current-user response envelope.
- Configure the QR app or QR BFF callback in the EPS SSO allowlist. For a temporary direct browser-to-EPS call, configure explicit credentialed CORS and confirm cookie `SameSite`, `Secure`, `Domain`, and `Path` against the deployed topology.
- Confirm response DTOs for department, team, position, area, and paged employee search against the active API contract. Treat source mappers as the implementation reference, not as a substitute for current contract verification.

### 2. Replace authentication boundary

- Add typed session/auth API functions for password login if still supported by policy, OIDC callback, logout, and current-user/session verification. In the BFF target these call QR backend session routes; only the transition client calls EPS auth endpoints directly.
- Update the shared Axios client for the selected topology and agreed single-flight refresh/401 behavior. Keep error normalization and cancellation behavior intact.
- Replace Supabase login submission with the agreed EPS identity flow. Register the correct QR/BFF callback route; complete the EPS exchange before navigating to the saved destination.
- Update the auth store/provider and protected-route bootstrap to represent a cookie session and fetch the canonical EPS user. Clear user/query state on logout or expired session.
- Remove the Supabase auth dependency from the app login path. Audit other Supabase consumers separately before removing shared Supabase configuration or dependencies.

### 3. Add read-only EPS employee and catalog APIs

- Add read-only QR-facing API functions and typed DTO-to-model mapping for employees, departments, teams, positions, and areas. During transition, their implementation may call EPS directly; target implementation calls the QR backend adapter.
- Preserve the employee search endpoint's actual paging and filter contract. Expose only filters supported by EPS; do not invent local tenant, role, or status filters that change source semantics.
- Add React Query hooks with stable keys for the shared system-wide datasets. Include `departmentId` in team keys when filtering teams; include normalized employee search/page/filter parameters in employee list keys.
- Pass TanStack Query `AbortSignal` into Axios. Keep catalog caching shared across routes and independent of component-local state.
- Do not add write API methods for these EPS resources. On any screen showing EPS-sourced records, omit create/edit/delete actions and keep any permitted QR-specific actions separate from EPS data mutations.

### 4. Switch consumers and remove tenant scoping from this integration

- Replace employee and catalog reads in `EpsQRCode` with the new EPS hooks, retaining existing list/detail presentation where its fields map cleanly.
- Remove tenant provider requirements, tenant IDs, and tenant-specific query keys from the EPS auth/catalog flow. The EPS API and its query cache represent the whole system, not a selected tenant.
- Inventory Supabase-backed employee fields and actions (custom fields, account/role management, avatar uploads, profile edits). Do not silently map these onto EPS. Remove them from the shared EPS employee surface or keep them explicitly outside this integration until their ownership is decided.
- Search for remaining direct Supabase employee/catalog reads so a page cannot mix local tenant data with EPS data.

### 5. Focused verification and rollout

- Verify login and SSO callbacks on the deployed QR origin, cookie persistence after reload, current-user restoration, logout, and expired-session recovery.
- Verify every read endpoint, response mapping, team filtering by department, list paging, query-key separation, and cancellation on navigation.
- Confirm the browser network log contains no employee/catalog write calls (POST is allowed only for the read-only `/employees/search` contract), and no tenant identifier on shared EPS requests.
- Check login failure, unavailable API, and expired-cookie states in the UI. Use focused TypeScript/import checks and targeted API/hook tests; run a production build after the integration is complete because it changes auth and shared request behavior.
- Roll out against a non-production EPS environment first, then verify the production cookie/CORS/SSO settings before enabling the app for users.

## Decisions and risks to resolve before implementation

1. **BFF timing:** Can QR backend proxy EPS auth and reference data for the first release, or is two-origin access required as a short transition?
2. **Identity contract:** Does EPS provide a shared OIDC issuer/token exchange for QR backend? If not, what server-to-server/delegated-user contract will be added?
3. **Cookie topology:** If the browser calls EPS directly during transition, are the app and API same-site or cross-site? This determines cookie/CORS behavior and cannot be solved by Axios alone.
4. **Database ownership:** Which QR-specific records belong in the QR database, and which employee fields are merely references or display snapshots?
5. **Employee surface:** Which current `EpsQRCode` employee fields/actions should remain when tenant-scoped Supabase CRUD is replaced by EPS read-only data?
6. **Catalog naming:** `PLEpsClient` labels `/api/v1/areas` as “chuyên môn”; confirm this is the intended catalog, distinct from positions.

## Completion criteria

- Both password login and EPS SSO establish a cookie-backed EPS session in `EpsQRCode`.
- The app restores the session after reload and handles logout/expiry cleanly.
- Employees and all four catalogs are read from EPS through typed API functions and shared React Query hooks.
- These requests have system-wide scope with no tenant identifier.
- The app has no path that mutates EPS employee or catalog data.
