# ErrorState

Use `ErrorState` for data-load failures. Use an empty state when a successful request returns no data;
do not present an empty result as an error.

`ErrorState` renders no `Card`, border, or surface background. Place it directly on the page background,
or in the content area of an existing parent card. Do not wrap it in another `Card`; preserve the parent
card's header and static labels so the error appears on the surface the user is already viewing.

Keep the page toolbar outside the error state. Provide a specific title and useful description, plus an
`onRetry` action when the failed request can be retried.

Use a page-wide `ErrorState` only when the core object for a single-object detail page failed to load.
For example, if a customer detail page cannot fetch the customer itself, show the error in the detail
content while retaining the toolbar. If the customer loads but one tab's query fails, keep the other
tabs available and show the error only inside the affected tab. Dashboards always localize errors to
the data cluster that failed; a failed dashboard query must not replace the dashboard with one page-wide
error.

For a failure inside a card, keep the card and its header, then put `ErrorState` directly in the card's
content area. This is the expected pattern for dashboard data clusters and independent detail tabs:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Kế hoạch thu tiền</CardTitle>
  </CardHeader>
  <CardContent className="p-0">
    <ErrorState
      title="Không tải được kế hoạch thu tiền"
      description={getApiErrorMessage(query.error)}
      onRetry={() => void query.refetch()}
      className="min-h-72"
    />
  </CardContent>
</Card>
```

Props: `title` is required; `description`, `onRetry`, `retryLabel`, and `className` are optional.
