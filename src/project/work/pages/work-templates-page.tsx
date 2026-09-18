import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { useTenant } from '@/providers/tenant-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { createWorkTemplate, loadWorkTemplates } from '../api/work.api';
import {
  useWorkTemplateForm,
  WorkTemplateFormDialog,
} from '../forms/work-template-form.generated';

export function WorkTemplatesPage() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useWorkTemplateForm();
  const query = useQuery({
    queryKey: ['project', 'work', 'templates', tenantId],
    queryFn: () => loadWorkTemplates(tenantId!),
    enabled: Boolean(tenantId),
  });
  const mutation = useMutation({
    mutationFn: (values: Parameters<typeof createWorkTemplate>[1]) =>
      createWorkTemplate(tenantId!, values),
    onSuccess: async () => {
      toast.success('Đã tạo mẫu công việc.');
      setOpen(false);
      form.reset();
      await queryClient.invalidateQueries({
        queryKey: ['project', 'work', 'templates'],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const templates = query.data ?? [];
  return (
    <div className="flex h-full flex-col gap-admin-page-section overflow-auto p-4 lg:p-5">
      <PageHeader
        title="Mẫu công việc"
        icon={ClipboardList}
        titleAside={
          <span className="text-sm text-muted-foreground">
            {templates.length} mẫu
          </span>
        }
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Thêm mẫu
          </Button>
        }
      />
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Quy trình mẫu</CardTitle>
            <CardDescription>
              Dùng lại các bước thường lặp lại trong nghiệp vụ kế toán dịch vụ.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            mode="icon"
            aria-label="Làm mới"
            onClick={() => void query.refetch()}
          >
            <RefreshCw />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-2">
            {templates.map((template) => (
              <div key={template.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {template.code}
                    </div>
                    <h3 className="font-semibold">{template.name}</h3>
                  </div>
                  <Badge variant={template.isActive ? 'secondary' : 'outline'}>
                    {template.isActive ? 'Đang dùng' : 'Tắt'}
                  </Badge>
                </div>
                {template.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {template.description}
                  </p>
                ) : null}
                <ol className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {template.steps.map((step) => (
                    <li key={step.id} className="flex gap-2">
                      <span className="size-5 shrink-0 rounded-full bg-muted text-center text-xs leading-5">
                        {step.sortOrder + 1}
                      </span>
                      <span>{step.title}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {!templates.length && !query.isPending ? (
              <div className="col-span-full rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                Chưa có mẫu công việc.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <WorkTemplateFormDialog
        open={open}
        onOpenChange={setOpen}
        mode="create"
        form={form}
        onSubmit={(values) => mutation.mutate(values)}
        isSaving={mutation.isPending}
        title="Thêm mẫu công việc"
      />
    </div>
  );
}
