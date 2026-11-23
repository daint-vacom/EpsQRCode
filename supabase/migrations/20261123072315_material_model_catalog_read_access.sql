drop policy if exists material_model_images_select_with_permission
  on public.material_model_images;
create policy material_model_images_select_with_permission
on public.material_model_images for select to authenticated
using (auth.uid() is not null);

drop policy if exists material_model_safety_checklists_select_with_permission
  on public.material_model_safety_checklists;
create policy material_model_safety_checklists_select_with_permission
on public.material_model_safety_checklists for select to authenticated
using (auth.uid() is not null);

drop policy if exists material_model_images_storage_select
  on storage.objects;
create policy material_model_images_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'material-model-images'
  and auth.uid() is not null
);
