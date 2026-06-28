-- TEF B1 App v1.0 Supabase 数据库初始化脚本
-- 使用方法：Supabase Dashboard → SQL Editor → New query → 粘贴全部 → Run

-- 1) 用户资料表
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nickname text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) 用户权限/有效期表
create table if not exists public.user_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text default '30天冲刺版',
  starts_at timestamptz default now(),
  expires_at timestamptz not null,
  status text default 'active',
  device_limit int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3) 设备绑定表
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  is_active boolean default true,
  unique(user_id, device_id)
);

-- 4) 进度/错题记录预留表。v1.0 默认仍使用本地错题板，后续可接这里做云端错题。
create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null,
  question_id text,
  is_correct boolean,
  selected_answer text,
  payload jsonb,
  created_at timestamptz default now()
);

-- 自动给新 auth 用户创建 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nickname)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 开启 RLS
alter table public.profiles enable row level security;
alter table public.user_access enable row level security;
alter table public.user_devices enable row level security;
alter table public.user_progress enable row level security;

-- 清理旧策略，便于重复运行脚本
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "access_select_own" on public.user_access;
drop policy if exists "devices_select_own" on public.user_devices;
drop policy if exists "devices_insert_own" on public.user_devices;
drop policy if exists "devices_update_own" on public.user_devices;
drop policy if exists "progress_select_own" on public.user_progress;
drop policy if exists "progress_insert_own" on public.user_progress;
drop policy if exists "progress_update_own" on public.user_progress;
drop policy if exists "progress_delete_own" on public.user_progress;

-- profiles：用户只能看/改自己的资料
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

-- user_access：用户只能读取自己的权限。插入/修改由你在后台手动完成。
create policy "access_select_own" on public.user_access
for select using (auth.uid() = user_id);

-- user_devices：用户只能看/新增/更新自己的设备记录
create policy "devices_select_own" on public.user_devices
for select using (auth.uid() = user_id);

create policy "devices_insert_own" on public.user_devices
for insert with check (auth.uid() = user_id);

create policy "devices_update_own" on public.user_devices
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_progress：预留云端错题/进度
create policy "progress_select_own" on public.user_progress
for select using (auth.uid() = user_id);

create policy "progress_insert_own" on public.user_progress
for insert with check (auth.uid() = user_id);

create policy "progress_update_own" on public.user_progress
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "progress_delete_own" on public.user_progress
for delete using (auth.uid() = user_id);

-- 给已存在但没有 profile 的 auth 用户补 profile
insert into public.profiles (id, email, nickname)
select id, email, split_part(email, '@', 1)
from auth.users
on conflict (id) do nothing;
