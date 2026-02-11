-- Supabase schema for multi-user chat
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

-- Profiles
create table if not exists public.chat_profiles (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  display_name text,
  gender text,
  birth_year integer,
  country text,
  city text,
  bio text,

  avatar_url text,
  photo_url text,
  avatar_color text,
  gallery_images jsonb,

  is_online boolean not null default false,
  is_guest boolean not null default true,
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  is_typing boolean not null default false,

  last_activity timestamptz,

  session_id text,
  admin_code text,

  auth_provider text,
  auth_subject text,
  email text,

  blocked_users jsonb
);

create index if not exists chat_profiles_online_idx on public.chat_profiles (is_online);
create index if not exists chat_profiles_auth_idx on public.chat_profiles (auth_provider, auth_subject);

-- Rooms
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  participant_ids jsonb,
  participant_names jsonb,

  status text,
  last_message text
);

create index if not exists chat_rooms_status_idx on public.chat_rooms (status);

-- 1:1 Messages
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  room_id uuid not null references public.chat_rooms(id) on delete cascade,

  sender_profile_id uuid,
  sender_name text,
  content text,

  file_url text,
  file_name text,
  image_url text
);

create index if not exists chat_messages_room_idx on public.chat_messages (room_id);

-- Groups
create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  name text,
  description text,

  creator_profile_id uuid,
  creator_name text,

  member_ids jsonb,
  member_count integer,

  last_message text
);

-- Group messages
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  group_id uuid not null references public.chat_groups(id) on delete cascade,

  sender_profile_id uuid,
  sender_name text,
  content text,
  image_url text
);

create index if not exists group_messages_group_idx on public.group_messages (group_id);

-- Support / reports
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  sender_profile_id uuid,
  sender_name text,
  subject text,
  message text,
  type text
);

-- Login history (for admin UI)
create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  profile_id uuid,
  display_name text,
  auth_provider text,
  auth_subject text,
  email text,
  ip text,
  user_agent text
);

-- NOTE:
-- For quick MVP testing you can leave RLS disabled.
-- For production, enable RLS and add policies that match your privacy/security expectations.

-- RLS: authenticated users only
alter table public.chat_profiles enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_groups enable row level security;
alter table public.group_messages enable row level security;
alter table public.support_messages enable row level security;
alter table public.login_events enable row level security;

create policy chat_profiles_auth_all on public.chat_profiles
  for all to authenticated
  using (true)
  with check (true);

create policy chat_profiles_anon_all on public.chat_profiles
  for all to anon
  using (true)
  with check (true);

create policy chat_rooms_auth_all on public.chat_rooms
  for all to authenticated
  using (true)
  with check (true);

create policy chat_rooms_anon_all on public.chat_rooms
  for all to anon
  using (true)
  with check (true);

create policy chat_messages_auth_all on public.chat_messages
  for all to authenticated
  using (true)
  with check (true);

create policy chat_messages_anon_all on public.chat_messages
  for all to anon
  using (true)
  with check (true);

create policy chat_groups_auth_all on public.chat_groups
  for all to authenticated
  using (true)
  with check (true);

create policy chat_groups_anon_all on public.chat_groups
  for all to anon
  using (true)
  with check (true);

create policy group_messages_auth_all on public.group_messages
  for all to authenticated
  using (true)
  with check (true);

create policy group_messages_anon_all on public.group_messages
  for all to anon
  using (true)
  with check (true);

create policy support_messages_auth_all on public.support_messages
  for all to authenticated
  using (true)
  with check (true);

create policy support_messages_anon_all on public.support_messages
  for all to anon
  using (true)
  with check (true);

create policy login_events_auth_all on public.login_events
  for all to authenticated
  using (true)
  with check (true);

create policy login_events_anon_all on public.login_events
  for all to anon
  using (true)
  with check (true);
