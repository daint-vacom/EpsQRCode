export function isMaterialGroupTreeDebugEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('debugMaterialTree') === '1'
  );
}

export function debugMaterialGroupTree(
  event: string,
  details: Record<string, unknown>,
): void {
  if (!isMaterialGroupTreeDebugEnabled()) return;

  const payload = {
    ...details,
    atMs: Number(performance.now().toFixed(1)),
  };
  console.debug(`[material-group-tree] ${event} ${JSON.stringify(payload)}`);
}
