begin;

-- Existing profiles have no verified owner. Preserve their rows without trusting
-- browser-stored profile IDs to grant access to their old private conversations.
alter table public.chat_profiles add column if not exists owner_id uuid;
alter table public.chat_profiles alter column owner_id set default auth.uid();
create index if not exists chat_profiles_owner_idx on public.chat_profiles (owner_id);
create unique index if not exists chat_profiles_admin_owner_idx
  on public.chat_profiles (owner_id) where is_admin and owner_id is not null;

alter table public.chat_profiles add column if not exists logout_block_until timestamptz;
alter table public.chat_messages
  add column if not exists read_by jsonb not null default '[]'::jsonb,
  add column if not exists read_at timestamptz;

alter table public.login_events add column if not exists owner_id uuid;
alter table public.login_events alter column owner_id set default auth.uid();

create or replace function public.chattko_is_admin()
returns boolean language sql stable set search_path = ''
as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' -> 'chattko_admin' = 'true'::jsonb, false)
    and (select auth.jwt()) -> 'is_anonymous' is distinct from 'true'::jsonb
$$;

create or replace function public.chattko_owns_profile(profile_id uuid)
returns boolean language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.chat_profiles p
    where p.id = profile_id and p.owner_id = (select auth.uid()) and not p.is_banned
  )
$$;

create or replace function public.chattko_is_participant(participants jsonb)
returns boolean language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.chat_profiles p
    where p.owner_id = (select auth.uid()) and not p.is_banned
      and participants ? p.id::text
  )
$$;

-- Replace policies on the affected tables. A permissive policy left alongside
-- the new ones would still grant access through PostgreSQL's policy OR semantics.
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in
      ('chat_profiles', 'chat_rooms', 'chat_messages', 'support_messages', 'login_events')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end
$$;

alter table public.chat_profiles enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.support_messages enable row level security;
alter table public.login_events enable row level security;

create policy profiles_directory on public.chat_profiles for select to authenticated using (true);
create policy profiles_create on public.chat_profiles for insert to authenticated
  with check (owner_id = (select auth.uid()) and not is_admin and not is_banned);
create policy profiles_update_own on public.chat_profiles for update to authenticated
  using (owner_id = (select auth.uid()) and not is_admin and not is_banned)
  with check (owner_id = (select auth.uid()) and not is_admin and not is_banned);
create policy profiles_delete_own on public.chat_profiles for delete to authenticated
  using (owner_id = (select auth.uid()) and not is_admin and not is_banned);
create policy profiles_admin on public.chat_profiles for all to authenticated
  using ((select public.chattko_is_admin())) with check ((select public.chattko_is_admin()));

-- Prevent guests from claiming an old participant ID or changing it later.
create or replace function public.chattko_guard_profile_id()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user = 'authenticated' and not public.chattko_is_admin() then
    if tg_op = 'INSERT' then
      new.id := gen_random_uuid();
    elsif new.id is distinct from old.id then
      raise exception 'Profile ID cannot be changed' using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists chattko_guard_profile_id on public.chat_profiles;
create trigger chattko_guard_profile_id before insert or update on public.chat_profiles
  for each row execute function public.chattko_guard_profile_id();

create policy rooms_participants on public.chat_rooms for select to authenticated
  using (public.chattko_is_participant(participant_ids));
create policy rooms_create on public.chat_rooms for insert to authenticated
  with check (
    case when jsonb_typeof(participant_ids) = 'array' then
      jsonb_array_length(participant_ids) = 2
      and participant_ids ->> 0 <> participant_ids ->> 1
      and public.chattko_is_participant(participant_ids)
    else false end
  );
create policy rooms_update_own on public.chat_rooms for update to authenticated
  using (public.chattko_is_participant(participant_ids))
  with check (public.chattko_is_participant(participant_ids));
create policy rooms_delete_own on public.chat_rooms for delete to authenticated
  using (public.chattko_is_participant(participant_ids));
create policy rooms_admin on public.chat_rooms for all to authenticated
  using ((select public.chattko_is_admin())) with check ((select public.chattko_is_admin()));

-- The chat_rooms lookup inherits its participant policy.
create policy messages_participants on public.chat_messages for select to authenticated
  using (exists (select 1 from public.chat_rooms r where r.id = room_id));
create policy messages_send on public.chat_messages for insert to authenticated
  with check (
    public.chattko_owns_profile(sender_profile_id)
    and exists (select 1 from public.chat_rooms r where r.id = room_id and r.participant_ids ? sender_profile_id::text)
  );
create policy messages_receipts on public.chat_messages for update to authenticated
  using (exists (select 1 from public.chat_rooms r where r.id = room_id))
  with check (exists (select 1 from public.chat_rooms r where r.id = room_id));
create policy messages_delete_own_room on public.chat_messages for delete to authenticated
  using (exists (select 1 from public.chat_rooms r where r.id = room_id));
create policy messages_admin on public.chat_messages for all to authenticated
  using ((select public.chattko_is_admin())) with check ((select public.chattko_is_admin()));

create or replace function public.chattko_guard_private_updates()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user <> 'authenticated' or public.chattko_is_admin() then
    return new;
  end if;
  if tg_table_name = 'chat_rooms' then
    if to_jsonb(new) - array['status', 'last_message', 'updated_date']
       is distinct from to_jsonb(old) - array['status', 'last_message', 'updated_date'] then
      raise exception 'Only room status and summary can be updated' using errcode = '42501';
    end if;
  elsif to_jsonb(new) - array['read_by', 'read_at', 'updated_date']
        is distinct from to_jsonb(old) - array['read_by', 'read_at', 'updated_date'] then
    raise exception 'Only private message read receipts can be updated' using errcode = '42501';
  end if;
  return new;
end
$$;

drop trigger if exists chattko_guard_private_room on public.chat_rooms;
create trigger chattko_guard_private_room before update on public.chat_rooms
  for each row execute function public.chattko_guard_private_updates();
drop trigger if exists chattko_guard_private_message on public.chat_messages;
create trigger chattko_guard_private_message before update on public.chat_messages
  for each row execute function public.chattko_guard_private_updates();

create policy support_submit on public.support_messages for insert to authenticated
  with check (public.chattko_owns_profile(sender_profile_id));
create policy support_read_own on public.support_messages for select to authenticated
  using (public.chattko_owns_profile(sender_profile_id));
create policy support_admin on public.support_messages for all to authenticated
  using ((select public.chattko_is_admin())) with check ((select public.chattko_is_admin()));

create policy login_events_record_own on public.login_events for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.chattko_owns_profile(profile_id));
create policy login_events_read_own on public.login_events for select to authenticated
  using (owner_id = (select auth.uid()));
create policy login_events_admin on public.login_events for all to authenticated
  using ((select public.chattko_is_admin())) with check ((select public.chattko_is_admin()));

commit;
