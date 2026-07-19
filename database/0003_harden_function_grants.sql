-- 0003_harden_function_grants.sql  ·  Function exposure hardening
--
-- Addresses Supabase database-linter findings after 0001/0002:
--   0011 function_search_path_mutable            (set_updated_at had no pinned search_path)
--   0028 anon_security_definer_function_executable (anon could call SECURITY DEFINER functions)
-- Supabase grants EXECUTE to anon/authenticated directly (not only via PUBLIC), so 0002's
-- `revoke ... from public` left the anon surface open. We revoke anon explicitly and re-grant
-- authenticated where the app / RLS actually needs it.

-- Trigger-only functions: never meant to be called through PostgREST (/rest/v1/rpc/...). Revoking
-- EXECUTE does NOT stop their triggers from firing; trigger functions run without an EXECUTE check.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at()  from public, anon, authenticated;
-- set_updated_at only calls now() (resolved from pg_catalog), so an empty search_path is safe.
alter function public.set_updated_at() set search_path = '';

-- Family RPCs: only a signed-in user ever previews or accepts an invite. Drop the anonymous surface;
-- keep authenticated. (Both already bail out when auth.uid() is null, so this is defense in depth.)
revoke all on function public.accept_family_invite(text)  from public, anon;
revoke all on function public.preview_family_invite(text) from public, anon;
grant execute on function public.accept_family_invite(text)  to authenticated;
grant execute on function public.preview_family_invite(text) to authenticated;

-- RLS helper predicates: referenced only inside policies and evaluated as the querying
-- (authenticated) role, so authenticated MUST retain EXECUTE. Drop the anonymous surface; the
-- explicit grant guarantees authenticated keeps EXECUTE even if its only prior grant came via PUBLIC.
revoke all on function public.is_family_group_member(uuid) from public, anon;
revoke all on function public.is_family_group_owner(uuid)  from public, anon;
revoke all on function public.is_family_manager_of(uuid)   from public, anon;
grant execute on function public.is_family_group_member(uuid) to authenticated;
grant execute on function public.is_family_group_owner(uuid)  to authenticated;
grant execute on function public.is_family_manager_of(uuid)   to authenticated;
