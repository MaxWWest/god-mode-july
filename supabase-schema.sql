create extension if not exists pgcrypto;

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

drop policy if exists "Users can delete their own challenge snapshot" on public.god_mode_challenge_snapshots;
create policy "Users can delete their own challenge snapshot"
  on public.god_mode_challenge_snapshots
  for delete
  using (auth.uid() = user_id);

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

drop policy if exists "Users can delete their own profile" on public.god_mode_profiles;
create policy "Users can delete their own profile"
  on public.god_mode_profiles
  for delete
  using (auth.uid() = user_id);

create table if not exists public.god_mode_friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint god_mode_friendships_not_self check (user_a <> user_b)
);

alter table public.god_mode_friendships
  add column if not exists requested_by uuid references auth.users(id) on delete cascade;

alter table public.god_mode_friendships
  add column if not exists status text;

alter table public.god_mode_friendships
  add column if not exists responded_at timestamptz;

update public.god_mode_friendships
set requested_by = created_by
where requested_by is null;

update public.god_mode_friendships
set status = 'accepted'
where status is null;

alter table public.god_mode_friendships
  alter column requested_by set not null;

alter table public.god_mode_friendships
  alter column status set default 'pending';

alter table public.god_mode_friendships
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'god_mode_friendships_status_check'
  ) then
    alter table public.god_mode_friendships
      add constraint god_mode_friendships_status_check
      check (status in ('pending', 'accepted', 'declined'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'god_mode_friendships_requested_by_participant'
  ) then
    alter table public.god_mode_friendships
      add constraint god_mode_friendships_requested_by_participant
      check (requested_by = user_a or requested_by = user_b);
  end if;
end $$;

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
    and auth.uid() = requested_by
    and (auth.uid() = user_a or auth.uid() = user_b)
    and user_a <> user_b
    and status = 'pending'
  );

drop policy if exists "Users can update their friendship requests" on public.god_mode_friendships;
create policy "Users can update their friendship requests"
  on public.god_mode_friendships
  for update
  using (auth.uid() = user_a or auth.uid() = user_b)
  with check (
    user_a <> user_b
    and requested_by in (user_a, user_b)
    and (
      (
        auth.uid() <> requested_by
        and status in ('accepted', 'declined')
      ) or (
        auth.uid() = requested_by
        and status = 'pending'
      )
    )
  );

drop policy if exists "Users can remove their friendships" on public.god_mode_friendships;
create policy "Users can remove their friendships"
  on public.god_mode_friendships
  for delete
  using (auth.uid() = user_a or auth.uid() = user_b);

create table if not exists public.god_mode_squads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.god_mode_squad_members (
  squad_id uuid not null references public.god_mode_squads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (squad_id, user_id)
);

alter table public.god_mode_squads enable row level security;
alter table public.god_mode_squad_members enable row level security;

drop policy if exists "Users can read their owned squads" on public.god_mode_squads;
create policy "Users can read their owned squads"
  on public.god_mode_squads
  for select
  using (auth.uid() = owner_id);

drop policy if exists "Users can create their owned squads" on public.god_mode_squads;
create policy "Users can create their owned squads"
  on public.god_mode_squads
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update their owned squads" on public.god_mode_squads;
create policy "Users can update their owned squads"
  on public.god_mode_squads
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete their owned squads" on public.god_mode_squads;
create policy "Users can delete their owned squads"
  on public.god_mode_squads
  for delete
  using (auth.uid() = owner_id);

drop policy if exists "Users can read owned squad members" on public.god_mode_squad_members;
create policy "Users can read owned squad members"
  on public.god_mode_squad_members
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.god_mode_squads squad
      where squad.id = god_mode_squad_members.squad_id
        and squad.owner_id = auth.uid()
    )
  );

drop policy if exists "Squad owners can add accepted friends" on public.god_mode_squad_members;
create policy "Squad owners can add accepted friends"
  on public.god_mode_squad_members
  for insert
  with check (
    auth.uid() = added_by
    and user_id <> auth.uid()
    and exists (
      select 1
      from public.god_mode_squads squad
      where squad.id = god_mode_squad_members.squad_id
        and squad.owner_id = auth.uid()
    )
    and exists (
      select 1
      from public.god_mode_friendships friendship
      where friendship.status = 'accepted'
        and (
          (
            friendship.user_a = auth.uid()
            and friendship.user_b = god_mode_squad_members.user_id
          ) or (
            friendship.user_b = auth.uid()
            and friendship.user_a = god_mode_squad_members.user_id
          )
        )
    )
  );

drop policy if exists "Users can remove owned squad members" on public.god_mode_squad_members;
create policy "Users can remove owned squad members"
  on public.god_mode_squad_members
  for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.god_mode_squads squad
      where squad.id = god_mode_squad_members.squad_id
        and squad.owner_id = auth.uid()
    )
  );

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
        and friendship.status = 'accepted'
      ) or (
        friendship.user_b = auth.uid()
        and friendship.user_a = god_mode_challenge_summaries.user_id
        and friendship.status = 'accepted'
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

drop policy if exists "Users can delete their own challenge summary" on public.god_mode_challenge_summaries;
create policy "Users can delete their own challenge summary"
  on public.god_mode_challenge_summaries
  for delete
  using (auth.uid() = user_id);

create table if not exists public.god_mode_friend_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  scoring_mode text not null default 'personal',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint god_mode_friend_challenges_date_order check (end_date >= start_date),
  constraint god_mode_friend_challenges_scoring_mode_check check (scoring_mode in ('personal', 'shared'))
);

create table if not exists public.god_mode_friend_challenge_participants (
  challenge_id uuid not null references public.god_mode_friend_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  summary jsonb,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (challenge_id, user_id),
  constraint god_mode_friend_challenge_participants_status_check check (status in ('pending', 'accepted', 'declined'))
);

create or replace function public.god_mode_is_friend_challenge_member(target_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.god_mode_friend_challenges challenge
    where challenge.id = target_challenge_id
      and challenge.creator_id = auth.uid()
  ) or exists (
    select 1
    from public.god_mode_friend_challenge_participants participant
    where participant.challenge_id = target_challenge_id
      and participant.user_id = auth.uid()
  );
$$;

alter table public.god_mode_friend_challenges enable row level security;
alter table public.god_mode_friend_challenge_participants enable row level security;

drop policy if exists "Challenge members can read friend challenges" on public.god_mode_friend_challenges;
create policy "Challenge members can read friend challenges"
  on public.god_mode_friend_challenges
  for select
  using (
    auth.uid() = creator_id
    or public.god_mode_is_friend_challenge_member(id)
  );

drop policy if exists "Users can create friend challenges" on public.god_mode_friend_challenges;
create policy "Users can create friend challenges"
  on public.god_mode_friend_challenges
  for insert
  with check (auth.uid() = creator_id);

drop policy if exists "Creators can update friend challenges" on public.god_mode_friend_challenges;
create policy "Creators can update friend challenges"
  on public.god_mode_friend_challenges
  for update
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

drop policy if exists "Creators can delete friend challenges" on public.god_mode_friend_challenges;
create policy "Creators can delete friend challenges"
  on public.god_mode_friend_challenges
  for delete
  using (auth.uid() = creator_id);

drop policy if exists "Challenge members can read participants" on public.god_mode_friend_challenge_participants;
create policy "Challenge members can read participants"
  on public.god_mode_friend_challenge_participants
  for select
  using (public.god_mode_is_friend_challenge_member(challenge_id));

drop policy if exists "Creators can invite challenge participants" on public.god_mode_friend_challenge_participants;
create policy "Creators can invite challenge participants"
  on public.god_mode_friend_challenge_participants
  for insert
  with check (
    invited_by = auth.uid()
    and (
      user_id = auth.uid()
      or exists (
        select 1
        from public.god_mode_friend_challenges challenge
        where challenge.id = god_mode_friend_challenge_participants.challenge_id
          and challenge.creator_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can update their challenge participant row" on public.god_mode_friend_challenge_participants;
create policy "Users can update their challenge participant row"
  on public.god_mode_friend_challenge_participants
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users and creators can delete challenge participants" on public.god_mode_friend_challenge_participants;
create policy "Users and creators can delete challenge participants"
  on public.god_mode_friend_challenge_participants
  for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.god_mode_friend_challenges challenge
      where challenge.id = god_mode_friend_challenge_participants.challenge_id
        and challenge.creator_id = auth.uid()
    )
  );
