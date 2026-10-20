# Server-side selects

## Endpoint pagination rule

Choose by domain growth and selection semantics, not by whether data comes from an API.

| Domain | Contract |
| --- | --- |
| Materials and other unbounded business records | Server search/filtering before stable pagination; separate selected-record resolution |
| Material groups, tags, roles, specific party/object types and other small bounded catalogs | Complete scoped catalog, fetched/cached once; local search; no pagination or request per keyword |
| Static statuses, conditions and other enums | Supplied options; no API |

If a catalog grows beyond a practical bound, deliberately change its endpoint contract. Never silently truncate a complete catalog at a provider row cap. A group-selection action must still select the complete group. EpsQRCode is single-workspace: scope account-sensitive queries by account/access state, without introducing tenants.

## Shared primitives

`OptionSelect` remains presentation-only. `ApiOptionSelect<T, F>` uses `useApiSelectSearch` with loader parameters `{ search, filters, page, pageSize, signal }` and results `{ options, hasMore? , total? }`. Bare arrays mean complete results. Page numbering starts at 1. Include every condition affecting the loader's result in serializable `filters` or the explicit domain `cacheKey`; object property order and callback identity must not change data identity. Mutations invalidate the existing domain prefix.

Defaults: 300 ms debounce, 30 rows, 60-second freshness, 5-minute unused-cache retention. Fresh reopen/remount reuses shared cache when `cacheKey` is supplied. Stale/invalidation refresh keeps current options visible. Different filters do not show another filter's previous results. Search is server-owned, with no second local filter. The selected option is retained for the controlled value and current data scope; fresh page data wins over a retained snapshot.

Pagination is guarded by all fetching, including background refresh, and uses `cancelRefetch: false`. Failed pages stop automatic scroll fetching; explicit retry requests the failed page. First-load and pagination errors are separate from empty state, and render compact shared `ErrorState` even when selected/cached options remain visible. A load-more button supports short lists and keyboard users. Window focus does not trigger a refetch loop.

The loader must forward `AbortSignal` to HTTP requests. Unused obsolete queries cancel through React Query. Closing disables new automatic requests, but an already running shared request may finish and populate cache. An `initialQuery` is also reflected in the search input, so QR-prefilled searches are visible and editable. Closing resets search.

## EpsQRCode adapters

- `MaterialSelect` defaults to fetch. Scope includes account ID and filters, including reservation exclusions and `allowReservedByHandoverId`. QR URLs and UUID searches become exact `id` filters in `list_materials`; all other filters still apply on the server. No post-pagination reservation filtering or JSON-stringified reload counters remain. `sourceMode="options" materials={...}` does not fetch or hydrate.
- `MaterialGroupSelect` keeps an ordinary complete-catalog query. It loads on open or to resolve a supplied value, caches for five minutes, searches locally, and provides explicit retry.
- `TagSelect` keeps the existing complete grouped catalog API and `providedOptions` name for options mode. Module-code sets are sorted/deduplicated for stable cache identity. The query loads on open or to resolve existing selected values, forwards cancellation through both group/tag requests, and offers retry for both presentation variants. No tags pagination is introduced.
- Shared `MultiSelect` exposes local error/retry and open-change callbacks without taking ownership of fetching.

## Required database follow-up

Local verification completed: 24 focused tests passed across API select, primitive option select, material select, material-group catalog and tag catalog. Focused import lint and production build passed. The explicit app-project TypeScript check still reports unrelated repository diagnostics; no diagnostics were reported for the changed select adapters/controllers. Browser and authenticated backend behavior remain unverified for this change.

The user deferred remote database work on 2026-10-20. Apply only `supabase/migrations/20261020065610_material_select_server_filters.sql` after checking migration history and comparing the current `list_materials(jsonb)` definition. It adds optional exact `id`, `excludeReserved` and `allowReservedByHandoverId` filters before both count and page selection. Existing callers without those fields preserve existing behavior and ordering/permission checks. No unrelated pending migrations should be applied implicitly.

Until this migration is applied, the current RPC does not implement the new select filters. The frontend change is **not end-to-end ready** for reservation/QR filtering against that old RPC; do not claim otherwise and do not add client compatibility fallbacks.

After applying, verify:

1. Page 1 excludes materials reserved by another handover before counting/pagination; later valid rows must remain reachable.
2. The current handover can still see its own reserved material when `allowReservedByHandoverId` matches.
3. A scanned QR URL/UUID returns exactly that material and respects all other filters.
4. Reopening a fresh select makes no new list request; changing search/filter creates one relevant request after debounce; old responses do not replace the current scope.
5. Selected material remains labeled across searches, pages and reopen; first/load-more failures have explicit retry without scroll retry loops.
6. Material-group/tag search stays local, without a request per keystroke, and mutations invalidate the affected cached catalogs.

Remote application was not attempted after the user's deferral. The configured direct DB endpoint failed DNS resolution; the CLI account did not list this project. Update connection access/session-pooler details before application. No credentials belong in this document.
