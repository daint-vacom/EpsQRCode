import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import { useTenant } from '@/providers/tenant-provider';
import { useUser } from '@/providers/user-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTable,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { OptionSelect } from '@/components/ui/option-select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FinanceCategory } from '../model/finance';

function queryParams(params: Record<string, string>) {
  return { params };
}

export function FinanceCategoryPanel({
  categories,
  isLoading,
}: {
  categories: FinanceCategory[];
  isLoading: boolean;
}) {
  const { tenantId } = useTenant();
  const { hasPermission } = useUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceCategory | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<'receipt' | 'payment' | 'both'>(
    'both',
  );
  const [parentId, setParentId] = useState('');
  const canManage = hasPermission('finance:category:manage');
  const mutation = useMutation({
    mutationFn: async () => {
      assertSupabaseConfigured();
      if (!tenantId) throw new Error('Chưa xác định tenant.');
      const payload = {
        tenant_id: tenantId,
        code: code.trim(),
        name: name.trim(),
        direction,
        parent_id: parentId || null,
        sort_order: editing?.sortOrder ?? categories.length,
      };
      if (editing)
        await supabaseApi.patch('/finance_categories', payload, {
          ...queryParams({ id: `eq.${editing.id}` }),
          headers: { Prefer: 'return=minimal' },
        });
      else await supabaseApi.post('/finance_categories', payload);
    },
    onSuccess: async () => {
      setOpen(false);
      toast.success(editing ? 'Đã cập nhật khoản mục.' : 'Đã tạo khoản mục.');
      await queryClient.invalidateQueries({
        queryKey: ['project', 'finance', 'categories', tenantId],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const toggleMutation = useMutation({
    mutationFn: async (category: FinanceCategory) => {
      assertSupabaseConfigured();
      await supabaseApi.patch(
        '/finance_categories',
        { is_active: !category.isActive },
        {
          ...queryParams({ id: `eq.${category.id}` }),
          headers: { Prefer: 'return=minimal' },
        },
      );
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ['project', 'finance', 'categories', tenantId],
      }),
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const openCreate = () => {
    setEditing(null);
    setCode('');
    setName('');
    setDirection('both');
    setParentId('');
    setOpen(true);
  };
  const openEdit = (category: FinanceCategory) => {
    setEditing(category);
    setCode(category.code);
    setName(category.name);
    setDirection(category.direction);
    setParentId(category.parentId ?? '');
    setOpen(true);
  };
  return (
    <Card className="min-h-0 w-full min-w-0 flex-1 overflow-hidden">
      <CardHeader>
        <CardTitle>Khoản mục thu chi</CardTitle>
        <CardToolbar>
          {canManage ? (
            <Button variant="primary" onClick={openCreate}>
              <Plus className="size-4" /> Thêm khoản mục
            </Button>
          ) : null}
        </CardToolbar>
      </CardHeader>
      <CardTable className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên khoản mục</TableHead>
                <TableHead>Nhóm cha</TableHead>
                <TableHead>Chiều</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Chưa có khoản mục
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-mono text-xs">
                      {category.code}
                    </TableCell>
                    <TableCell className="font-medium">
                      {category.name}
                    </TableCell>
                    <TableCell>{category.parentName || '—'}</TableCell>
                    <TableCell>
                      {category.direction === 'both'
                        ? 'Dùng chung'
                        : category.direction === 'receipt'
                          ? 'Thu'
                          : 'Chi'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={category.isActive ? 'success' : 'outline'}
                      >
                        {category.isActive ? 'Đang dùng' : 'Ngừng dùng'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {canManage ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              mode="icon"
                              size="sm"
                              aria-label={`Sửa ${category.name}`}
                              onClick={() => openEdit(category)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              mode="icon"
                              size="sm"
                              aria-label={`${category.isActive ? 'Ngừng dùng' : 'Kích hoạt'} ${category.name}`}
                              onClick={() => toggleMutation.mutate(category)}
                            >
                              <Power className="size-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardTable>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Sửa khoản mục' : 'Thêm khoản mục'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Mã khoản mục
              </label>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="thu-phi-dich-vu"
                disabled={Boolean(editing)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Tên khoản mục
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Thu phí dịch vụ"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Chiều</label>
              <OptionSelect
                value={direction}
                onChange={(value) =>
                  setDirection((value || 'both') as typeof direction)
                }
                options={[
                  { value: 'receipt', label: 'Thu' },
                  { value: 'payment', label: 'Chi' },
                  { value: 'both', label: 'Dùng chung' },
                ]}
                searchable={false}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Nhóm cha
              </label>
              <OptionSelect
                value={parentId}
                onChange={(value) => setParentId(value || '')}
                options={categories
                  .filter((item) => item.id !== editing?.id)
                  .map((item) => ({ value: item.id, label: item.name }))}
                searchable
                placeholder="Không có nhóm cha"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={mutation.isPending}
              onClick={() => {
                if (!code.trim() || !name.trim()) {
                  toast.error('Vui lòng nhập mã và tên khoản mục.');
                  return;
                }
                mutation.mutate();
              }}
            >
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
