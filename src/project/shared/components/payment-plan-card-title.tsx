import { CalendarClock } from 'lucide-react';
import { CardTitle } from '@/components/ui/card';

export function PaymentPlanCardTitle({ className }: { className?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <CalendarClock className="size-4" aria-hidden="true" />
      </span>
      <CardTitle className={className}>Kế hoạch thu tiền</CardTitle>
    </div>
  );
}
