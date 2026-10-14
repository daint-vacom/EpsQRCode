import { Package } from 'lucide-react';

export function MaterialIdentity({
  name,
  code,
  imageUrl,
}: {
  name: string;
  code: string;
  imageUrl?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="size-10 shrink-0 rounded-admin-control border border-border object-cover"
        />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-admin-control border border-border bg-admin-surface-alt text-muted-foreground">
          <Package className="size-5" aria-hidden="true" />
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">{code}</span>
      </span>
    </div>
  );
}
