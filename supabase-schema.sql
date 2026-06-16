create table if not exists public.god_mode_challenge_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  entries jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.god_mode_challenge_snapshots enable row level security;

drop policy if exists "Users can read their own challenge snapshot" on public.god_mode_challenge_snapshots;
create policy "Users can read their own challenge snapshot"
  on public.god_mode_challenge_snapshots
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own challenge snapshot" on public.god_mode_challenge_snapshots;
create policy "Users can insert their own challenge snapshot"
  on public.god_mode_challenge_snapshots
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own challenge snapshot" on public.god_mode_challenge_snapshots;
create policy "Users can update their own challenge snapshot"
  on public.god_mode_challenge_snapshots
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.god_mode_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.god_mode_profiles enable row level security;

drop policy if exists "Authenticated users can find profiles by invite code" on public.god_mode_profiles;
create policy "Authenticated users can find profiles by invite code"
  on public.god_mode_profiles
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "Users can insert their own profile" on public.god_mode_profiles;
create policy "Users can insert their own profile"
  on public.god_mode_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.god_mode_profiles;
create policy "Users can update their own profile"
  on public.god_mode_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.god_mode_friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint god_mode_friendships_not_self check (user_a <> user_b)
);

alter table public.god_mode_friendships enable row level security;

drop policy if exists "Users can read their friendships" on public.god_mode_friendships;
create policy "Users can read their friendships"
  on public.god_mode_friendships
  for select
  using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "Users can create their friendships" on public.god_mode_friendships;
create policy "Users can create their friendships"
  on public.god_mode_friendships
  for insert
  with check (
    auth.uid() = created_by
    and (auth.uid() = user_a or auth.uid() = user_b)
    and user_a <> user_b
  );

drop policy if exists "Users can remove their friendships" on public.god_mode_friendships;
create policy "Users can remove their friendships"
  on public.god_mode_friendships
  for delete
  using (auth.uid() = user_a or auth.uid() = user_b);

create table if not exists public.god_mode_challenge_summaries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  challenge_title text not null,
  start_date date not null,
  end_date date not null,
  logged_days integer not null default 0,
  total_days integer not null default 0,
  average_completion integer not null default 0,
  weekly_completion integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_logged_date date,
  updated_at timestamptz not null default now()
);

alter table public.god_mode_challenge_summaries enable row level security;

drop policy if exists "Users can read own and friends summaries" on public.god_mode_challenge_summaries;
create policy "Users can read own and friends summaries"
  on public.god_mode_challenge_summaries
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.god_mode_friendships friendship
      where (
        friendship.user_a = auth.uid()
        and friendship.user_b = god_mode_challenge_summaries.user_id
      ) or (
        friendship.user_b = auth.uid()
        and friendship.user_a = god_mode_challenge_summaries.user_id
      )
    )
  );

drop policy if exists "Users can insert their own challenge summary" on public.god_mode_challenge_summaries;
create policy "Users can insert their own challenge summary"
  on public.god_mode_challenge_summaries
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own challenge summary" on public.god_mode_challenge_summaries;
create policy "Users can update their own challenge summary"
  on public.god_mode_challenge_summaries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
