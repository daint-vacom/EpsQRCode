-- The function is invoked only by the permission-definition trigger.
-- Clients must not be able to call a SECURITY DEFINER trigger function as an RPC.
revoke all on function public.sync_grant_all_role_permissions()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
