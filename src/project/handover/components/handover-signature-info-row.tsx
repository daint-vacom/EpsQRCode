import { Badge } from '@/components/ui/badge';

export function HandoverSignatureInfoRow({
  label,
  value,
  tone = 'default',
  solidBadge = false,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'destructive';
  solidBadge?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[9rem_minmax(0,1fr)] items-start gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {solidBadge ? (
        <Badge
          variant={tone === 'default' ? 'secondary' : tone}
          size="sm"
          className="w-fit"
        >
          {value || '—'}
        </Badge>
      ) : (
        <span
          className={`min-w-0 break-words font-normal ${
            tone === 'success'
              ? 'text-admin-success-text'
              : tone === 'destructive'
                ? 'text-destructive'
                : 'text-foreground'
          }`}
        >
          {value || '—'}
        </span>
      )}
    </div>
  );
}
