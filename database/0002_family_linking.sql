-- 0002_family_linking.sql  ·  Family linking (Max plan)
--
-- A Max-holding "manager" links dependent accounts and may VIEW and MANAGE (create / edit / delete)
-- their meal logs. The link is strictly one-way: a dependent never sees the manager's data and gains
-- no paid features from joining. Invitations are single-use bearer tokens shared as an https
-- universal link; only a sha256 hash of the token is stored, so a database leak exposes no usable
-- links.
--
-- Depends on 0001_init.sql (profiles, daily_logs, food_entries and their owner-only RLS). Uses the
-- core sha256() function (PostgreSQL 11+), so no extension beyond what 0001 already enables.
--
-- Group size cap: 1 manager + up to 5 dependents (family_groups.max_members = 6). Keep in lockstep
-- with FAMILY_MAX_MEMBERS in utils/familyInvite.ts.

-- Enums -----------------------------------------------------------------
create type family_role as enum ('manager', 'dependent');
create type family_invite_status as enum ('pending', 'accepted', 'revoked', 'expired');

-- Tables ----------------------------------------------------------------
create table family_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text,
  name_zh text,
  max_members integer not null default 6 check (max_members between 2 and 20),
  created_at timestamptz not null default now()
);
-- One family group per owner: a manager runs exactly one household.
create unique index family_groups_one_per_owner on family_groups (owner_id);

create table family_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references family_groups (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role family_role not null,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index family_members_group_idx on family_members (group_id);
create index family_members_user_idx on family_members (user_id);
-- A user can be a dependent in at most one family at a time (managers are unaffected).
create unique index family_members_one_dependency on family_members (user_id) where (role = 'dependent');

create table family_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references family_groups (id) on delete cascade,
  inviter_id uuid not null references profiles (id) on delete cascade,
  token_hash text not null unique,           -- sha256 hex of the raw token; the raw token is never stored
  invitee_label text,                         -- optional free-text hint ("Mom"); not depended-on PII
  status family_invite_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index family_invitations_group_idx on family_invitations (group_id);
create index family_invitations_status_idx on family_invitations (status);

-- Helper predicates ------------------------------------------------------
-- SECURITY DEFINER so they read the family tables WITHOUT invoking those tables' own RLS (which
-- would recurse). STABLE and pinned to an empty search_path; every reference is schema-qualified.

create or replace function public.is_family_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members m
    where m.group_id = gid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_family_group_owner(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_groups g
    where g.id = gid and g.owner_id = auth.uid()
  );
$$;

-- True when the current user is the MANAGER of a group in which `dependent` is an active dependent.
-- The single predicate the manager's cross-account meal-log access is gated on.
create or replace function public.is_family_manager_of(dependent uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.family_members mgr
    join public.family_members dep on dep.group_id = mgr.group_id
    where mgr.user_id = auth.uid()
      and mgr.role = 'manager'
      and dep.user_id = dependent
      and dep.role = 'dependent'
  );
$$;

-- Row level security: the new tables ------------------------------------
alter table family_groups enable row level security;
alter table family_members enable row level security;
alter table family_invitations enable row level security;

-- Groups: any member (owner included) can read their group; the owner may disband it. All creation
-- happens server-side (the create-family-invite Edge Function, service role), never from the client.
create policy family_groups_read on family_groups
  for select using (public.is_family_group_member(id) or owner_id = auth.uid());
create policy family_groups_owner_delete on family_groups
  for delete using (owner_id = auth.uid());

-- Members: any member reads their group's roster (a dependent sees who links them; a manager sees
-- dependents). Removal: the owner removes anyone; a member removes (leaves) themselves. Inserts flow
-- only through accept_family_invite / the Edge Function.
create policy family_members_read on family_members
  for select using (public.is_family_group_member(group_id));
create policy family_members_delete on family_members
  for delete using (user_id = auth.uid() or public.is_family_group_owner(group_id));

-- Invitations: the manager (owner or the original inviter) reads and revokes their invites. There is
-- deliberately NO client insert and NO token-based select: acceptance flows through the RPCs, which
-- resolve invites by hash under SECURITY DEFINER.
create policy family_invitations_read on family_invitations
  for select using (public.is_family_group_owner(group_id) or inviter_id = auth.uid());
create policy family_invitations_owner_update on family_invitations
  for update using (public.is_family_group_owner(group_id))
  with check (public.is_family_group_owner(group_id));
create policy family_invitations_owner_delete on family_invitations
  for delete using (public.is_family_group_owner(group_id));

-- Row level security: additive manager access to a dependent's nutrition records ------------------
-- PERMISSIVE policies added ALONGSIDE the existing owner-only policies from 0001, so the effective
-- rule is OR: a row stays reachable by its owner (unchanged) and additionally by that owner's family
-- manager. Scope is meal / nutrition logs ONLY (daily_logs + food_entries). Recipes, pantry, meal
-- plans, grocery lists and profile edits remain private to their owner.

create policy manager_manage_daily_logs on daily_logs
  for all
  using (public.is_family_manager_of(user_id))
  with check (public.is_family_manager_of(user_id));

create policy manager_manage_food_entries on food_entries
  for all
  using (
    exists (
      select 1 from daily_logs d
      where d.id = food_entries.daily_log_id and public.is_family_manager_of(d.user_id)
    )
  )
  with check (
    exists (
      select 1 from daily_logs d
      where d.id = food_entries.daily_log_id and public.is_family_manager_of(d.user_id)
    )
  );

-- Read-only view of a dependent's profile (display name, calorie target) so the manager UI can label
-- "Mom's log". SELECT only: a manager can never edit a dependent's profile.
create policy manager_read_profiles on profiles
  for select using (public.is_family_manager_of(id));

-- RPC: preview an invitation (HA Go's "pending final confirmation" step) -------------------------
-- Returns who is inviting + the invite's state, WITHOUT accepting, so the accept screen can show the
-- inviter before the user commits. SECURITY DEFINER: it must resolve an invite it doesn't own (by
-- hash) and read the inviter's name. Read-only. Granted to authenticated only.
create or replace function public.preview_family_invite(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_hash text := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  v_inv public.family_invitations;
  v_group public.family_groups;
  v_inviter_name text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into v_inv from public.family_invitations where token_hash = v_hash;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_group from public.family_groups where id = v_inv.group_id;
  select coalesce(display_name, '') into v_inviter_name from public.profiles where id = v_inv.inviter_id;

  return jsonb_build_object(
    'ok', (v_inv.status = 'pending' and v_inv.expires_at > now()),
    'status', v_inv.status,
    'expired', (v_inv.expires_at <= now()),
    'inviter_name', v_inviter_name,
    'group_name', v_group.name,
    'group_name_zh', v_group.name_zh,
    'expires_at', v_inv.expires_at
  );
end;
$$;

-- RPC: accept an invitation and link the two accounts --------------------------------------------
-- The secure commit step. Validates the token (pending, unexpired, not self, caller not already in a
-- family), enforces the group-size cap, inserts the caller as a dependent, and burns the token. Row
-- lock (FOR UPDATE) makes a double-tap idempotent. SECURITY DEFINER + granted to authenticated: a
-- dependent needs no Max plan, so no server secret is involved and a plain RPC is the right tool.
create or replace function public.accept_family_invite(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  v_uid uuid := auth.uid();
  v_inv public.family_invitations;
  v_max integer;
  v_count integer;
  v_inviter_name text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  -- Lock the invite so two concurrent taps cannot both consume a single-use token.
  select * into v_inv from public.family_invitations where token_hash = v_hash for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if v_inv.status <> 'pending' then
    return jsonb_build_object(
      'ok', false,
      'reason', case when v_inv.status = 'accepted' then 'already_used' else v_inv.status::text end
    );
  end if;

  if v_inv.expires_at <= now() then
    update public.family_invitations set status = 'expired' where id = v_inv.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_inv.inviter_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  -- One family per user: block if already a member anywhere (manager or dependent).
  if exists (select 1 from public.family_members where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'already_linked');
  end if;

  select max_members into v_max from public.family_groups where id = v_inv.group_id;
  select count(*) into v_count from public.family_members where group_id = v_inv.group_id;
  if v_count >= v_max then
    return jsonb_build_object('ok', false, 'reason', 'group_full');
  end if;

  insert into public.family_members (group_id, user_id, role)
  values (v_inv.group_id, v_uid, 'dependent');

  update public.family_invitations
    set status = 'accepted', accepted_by = v_uid, accepted_at = now()
    where id = v_inv.id;

  select coalesce(display_name, '') into v_inviter_name from public.profiles where id = v_inv.inviter_id;
  return jsonb_build_object('ok', true, 'group_id', v_inv.group_id, 'inviter_name', v_inviter_name);
end;
$$;

revoke all on function public.preview_family_invite(text) from public;
revoke all on function public.accept_family_invite(text) from public;
grant execute on function public.preview_family_invite(text) to authenticated;
grant execute on function public.accept_family_invite(text) to authenticated;
