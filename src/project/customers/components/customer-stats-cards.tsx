import type { LucideIcon } from 'lucide-react';
import { MessageCircleOff, UserCheck, UserRoundX, Users } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { CustomerStats } from '../api/customers.api';

type CustomerStatTone = 'blue' | 'green' | 'amber' | 'slate';

const toneClasses: Record<CustomerStatTone, string> = {
  blue: 'bg-admin-blue-bg text-admin-blue-primary',
  green: 'bg-admin-success-bg text-admin-success-text',
  amber: 'bg-admin-amber-bg text-admin-amber-dark',
  slate: 'bg-muted text-muted-foreground',
};

interface CustomerStatCardConfig {
  key: keyof CustomerStats;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: CustomerStatTone;
}

const customerStatCards: readonly CustomerStatCardConfig[] = [
  {
    key: 'total',
    label: 'Tổng số khách hàng',
    description: 'Tất cả khách hàng trong tổ chức',
    icon: Users,
    tone: 'blue',
  },
  {
    key: 'active',
    label: 'Đang hoạt động',
    description: 'Khách hàng đang hoạt động',
    icon: UserCheck,
    tone: 'green',
  },
  {
    key: 'inactive',
    label: 'Ngừng hoạt động',
    description: 'Khách hàng đã ngừng hoạt động',
    icon: UserRoundX,
    tone: 'amber',
  },
  {
    key: 'withoutContact',
    label: 'Chưa liên hệ',
    description: 'Chưa có số điện thoại và email',
    icon: MessageCircleOff,
    tone: 'slate',
  },
];

export function CustomerStatsCards({
  stats,
  isLoading = false,
}: {
  stats?: CustomerStats;
  isLoading?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {customerStatCards.map(
        ({ key, label, description, icon: Icon, tone }) => (
          <Card key={key}>
            <CardContent className="flex min-h-28 items-center gap-3 p-4">
              <span
                className={`inline-flex size-12 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}
              >
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <CardDescription className="truncate">{label}</CardDescription>
                {isLoading ? (
                  <Skeleton className="mt-2 h-7 w-24" />
                ) : (
                  <CardTitle className="mt-1 text-2xl tabular-nums">
                    {stats ? formatNumber(stats[key]) : '—'}
                  </CardTitle>
                )}
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {description}
                </p>
              </div>
            </CardContent>
          </Card>
        ),
      )}
    </div>
  );
}
