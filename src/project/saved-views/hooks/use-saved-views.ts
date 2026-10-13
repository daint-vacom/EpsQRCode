import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSavedView,
  deleteSavedView,
  loadSavedViews,
  updateSavedView,
} from '../api/saved-views.api';
import type {
  SavedView,
  SavedViewConfig,
  SavedViewResource,
} from '../model/saved-view';

interface UseSavedViewsOptions {
  userId: string | null | undefined;
  resource: SavedViewResource;
}

interface SaveSavedViewInput<TFilters extends object> {
  name: string;
  view: SavedView<TFilters> | null;
  config: SavedViewConfig<TFilters>;
}

export function useSavedViews<TFilters extends object>({
  userId,
  resource,
}: UseSavedViewsOptions) {
  const queryClient = useQueryClient();
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const queryKey = ['project', 'saved-views', resource] as const;

  const savedViewsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => loadSavedViews<TFilters>(resource, signal),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  });

  const savedViews = savedViewsQuery.data ?? [];
  const activeView =
    savedViews.find((view) => view.id === activeViewId) ?? null;

  const invalidateSavedViews = () =>
    queryClient.invalidateQueries({ queryKey });

  const saveMutation = useMutation({
    mutationFn: async ({
      name,
      view,
      config,
    }: SaveSavedViewInput<TFilters>) => {
      if (!userId) {
        throw new Error('Chưa xác định tài khoản đăng nhập.');
      }

      return view
        ? updateSavedView(userId, view, name, config)
        : createSavedView(userId, resource, name, config);
    },
    onSuccess: async (view) => {
      setActiveViewId(view.id);
      await invalidateSavedViews();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (view: SavedView<TFilters>) => {
      return deleteSavedView(view.id);
    },
    onSuccess: async (_, view) => {
      if (activeViewId === view.id) setActiveViewId(null);
      await invalidateSavedViews();
    },
  });

  return {
    savedViewsQuery,
    savedViews,
    activeViewId,
    setActiveViewId,
    activeView,
    saveMutation,
    deleteMutation,
    invalidateSavedViews,
  };
}

export type { SaveSavedViewInput, UseSavedViewsOptions };
