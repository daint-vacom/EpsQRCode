import { useQuery } from '@tanstack/react-query';
import { assertSupabaseConfigured, supabaseApi } from '@/lib/supabase';
import { useUser } from '@/providers/user-provider';

export const pendingDocumentCountsKey = [
  'project',
  'my-pending-document-counts',
] as const;

interface PendingDocumentCounts {
  safetyInspections: number;
  handovers: number;
  materialReceipts: number;
}

export function useMyPendingDocumentCounts() {
  const { userId } = useUser();
  return useQuery({
    queryKey: [...pendingDocumentCountsKey, userId],
    enabled: Boolean(userId),
    queryFn: async ({ signal }) => {
      assertSupabaseConfigured();
      return (await supabaseApi.post(
        '/rpc/get_my_pending_document_counts',
        {},
        { signal },
      )) as unknown as PendingDocumentCounts;
    },
  });
}
