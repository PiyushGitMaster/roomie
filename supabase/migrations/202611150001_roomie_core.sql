create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  age integer not null check (age >= 18 and age <= 120),
  accepted_18_at timestamptz not null,
  profession text check (char_length(profession) <= 120),
  city text check (char_length(city) <= 120),
  areas text[] not null default '{}',
  bio text check (char_length(bio) <= 500),
  photo_url text,
  budget_min integer check (budget_min is null or budget_min >= 0),
  budget_max integer check (budget_max is null or budget_max >= 0),
  move_in_date date,
  room_type text check (room_type in ('private', 'shared', 'either')),
  lifestyle jsonb not null default '{}'::jsonb,
  hide_exact_locality boolean not null default false,
  is_visible boolean not null default false,
  is_suspended boolean not null default false,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_min is null or budget_max is null or budget_min <= budget_max),
  check (not is_visible or photo_url is not null),
  check (not hide_exact_locality or cardinality(areas) = 0)
);

create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  position smallint not null default 0 check (position between 0 and 3),
  created_at timestamptz not null default now(),
  unique (user_id, storage_path),
  unique (user_id, position)
);

create table public.accommodation_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  deposit_capacity integer check (deposit_capacity is null or deposit_capacity >= 0),
  stay_duration text,
  furnished text check (furnished in ('furnished', 'unfurnished', 'either')),
  property_type text,
  housing_status text check (housing_status in ('has_flat', 'needs_flat')),
  commute_distance_km numeric check (commute_distance_km is null or commute_distance_km >= 0),
  transit_need text,
  updated_at timestamptz not null default now()
);

create table public.lifestyle_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.preferred_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  city text not null,
  area text not null,
  unique (user_id, city, area)
);

create table public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('like', 'pass')),
  created_at timestamptz not null default now(),
  unique (user_id, target_id),
  check (user_id <> target_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create table public.match_journeys (
  match_id uuid primary key references public.matches(id) on delete cascade,
  step smallint not null default 1 check (step between 1 and 3),
  user_a_confirmed boolean not null default false,
  user_b_confirmed boolean not null default false,
  user_a_met boolean not null default false,
  user_b_met boolean not null default false,
  user_a_comfortable boolean not null default false,
  user_b_comfortable boolean not null default false,
  paused boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.meeting_proposals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id) on delete cascade,
  place text not null check (char_length(place) between 2 and 200),
  proposed_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'countered', 'completed')),
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create table public.saved_profiles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, profile_id),
  check (user_id <> profile_id)
);

create table public.property_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 150),
  city text not null,
  locality text not null,
  rent integer not null check (rent > 0),
  deposit integer check (deposit is null or deposit >= 0),
  rooms_available smallint not null default 1 check (rooms_available > 0),
  furnished text check (furnished in ('furnished', 'unfurnished', 'partly_furnished')),
  amenities text[] not null default '{}',
  available_from date,
  description text not null check (char_length(description) <= 2000),
  contact_email text not null check (contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  verified_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.property_listings(id) on delete cascade,
  storage_path text not null,
  position smallint not null default 0 check (position between 0 and 9),
  created_at timestamptz not null default now(),
  unique (listing_id, storage_path),
  unique (listing_id, position)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  listing_id uuid references public.property_listings(id) on delete set null,
  reason text not null check (char_length(reason) between 2 and 100),
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  check (reported_user_id is not null or listing_id is not null)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  private_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('like', 'save', 'match', 'message', 'system')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  quote text not null check (char_length(quote) between 10 and 800),
  display_name text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index profiles_discover_idx on public.profiles (city, age) where is_visible and not is_suspended;
create index profiles_areas_idx on public.profiles using gin (areas);
create index likes_target_action_idx on public.likes (target_id, action);
create index matches_user_a_idx on public.matches (user_a, created_at desc);
create index matches_user_b_idx on public.matches (user_b, created_at desc);
create index messages_match_time_idx on public.messages (match_id, created_at);
create index listings_search_idx on public.property_listings (city, locality, rent) where status = 'active';
create index notifications_user_time_idx on public.notifications (user_id, created_at desc);
create index reports_status_time_idx on public.reports (status, created_at desc);

create or replace function public.is_roomie_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_roles where user_id = (select auth.uid()));
$$;

create or replace function public.is_match_member(target_match_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.id = target_match_id and (m.user_a = (select auth.uid()) or m.user_b = (select auth.uid()))
  );
$$;

create or replace function public.is_blocked_with(target_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b where
      (b.blocker_id = (select auth.uid()) and b.blocked_id = target_user_id) or
      (b.blocker_id = target_user_id and b.blocked_id = (select auth.uid()))
  );
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  claimed_age integer;
  accepted_at timestamptz;
begin
  claimed_age := nullif(new.raw_user_meta_data ->> 'age', '')::integer;
  accepted_at := nullif(new.raw_user_meta_data ->> 'accepted_18_at', '')::timestamptz;
  if claimed_age is null or claimed_age < 18 or accepted_at is null then
    raise exception 'ROOMIE is only available to adults aged 18 or older.';
  end if;
  insert into public.profiles (id, full_name, age, accepted_18_at)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), claimed_age, accepted_at);
  return new;
end;
$$;

create trigger on_auth_user_created_roomie
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.create_match_on_mutual_like()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  low_id uuid;
  high_id uuid;
begin
  if new.action <> 'like' or (tg_op = 'UPDATE' and old.action = new.action) then return new; end if;
  if exists (
    select 1 from public.likes reciprocal
    where reciprocal.user_id = new.target_id and reciprocal.target_id = new.user_id and reciprocal.action = 'like'
  ) and not exists (
    select 1 from public.blocks b where
      (b.blocker_id = new.user_id and b.blocked_id = new.target_id) or
      (b.blocker_id = new.target_id and b.blocked_id = new.user_id)
  ) then
    low_id := least(new.user_id, new.target_id);
    high_id := greatest(new.user_id, new.target_id);
    insert into public.matches (user_a, user_b) values (low_id, high_id) on conflict do nothing;
    insert into public.notifications (user_id, actor_id, kind)
      values (new.user_id, new.target_id, 'match'), (new.target_id, new.user_id, 'match');
  else
    insert into public.notifications (user_id, actor_id, kind)
      values (new.target_id, new.user_id, 'like');
  end if;
  return new;
end;
$$;

create trigger on_like_recorded
  after insert or update of action on public.likes
  for each row execute function public.create_match_on_mutual_like();

create or replace function public.create_journey_for_match()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.match_journeys (match_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_match_created
  after insert on public.matches
  for each row execute function public.create_journey_for_match();

create or replace function public.record_like(target_profile_id uuid, like_action text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  mutual boolean := false;
begin
  if caller is null or target_profile_id = caller then raise exception 'Invalid profile.'; end if;
  if like_action not in ('like', 'pass') then raise exception 'Invalid action.'; end if;
  if not exists (select 1 from public.profiles p where p.id = caller and p.age >= 18 and not p.is_suspended) then
    raise exception 'Your account cannot use discovery right now.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_profile_id and p.is_visible and p.age >= 18 and not p.is_suspended) then
    raise exception 'This profile is not available.';
  end if;
  if exists (select 1 from public.blocks b where
    (b.blocker_id = caller and b.blocked_id = target_profile_id) or
    (b.blocker_id = target_profile_id and b.blocked_id = caller)) then
    raise exception 'This profile is not available.';
  end if;
  insert into public.likes (user_id, target_id, action)
    values (caller, target_profile_id, like_action)
    on conflict (user_id, target_id) do update set action = excluded.action;
  select exists (
    select 1 from public.matches m where
    (m.user_a = least(caller, target_profile_id) and m.user_b = greatest(caller, target_profile_id))
  ) into mutual;
  return mutual;
end;
$$;

create or replace function public.get_match_journey(target_match_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  journey public.match_journeys%rowtype;
  caller uuid := (select auth.uid());
  caller_is_a boolean;
begin
  select j.* into journey from public.match_journeys j
    join public.matches m on m.id = j.match_id
    where m.id = target_match_id and (m.user_a = caller or m.user_b = caller);
  if not found then raise exception 'Journey not found.'; end if;
  select m.user_a = caller into caller_is_a from public.matches m where m.id = target_match_id;
  return jsonb_build_object(
    'step', journey.step,
    'confirmed_by_me', case when caller_is_a then journey.user_a_confirmed else journey.user_b_confirmed end,
    'confirmed_by_them', case when caller_is_a then journey.user_b_confirmed else journey.user_a_confirmed end,
    'met_by_me', case when caller_is_a then journey.user_a_met else journey.user_b_met end,
    'met_by_them', case when caller_is_a then journey.user_b_met else journey.user_a_met end,
    'comfortable_by_me', case when caller_is_a then journey.user_a_comfortable else journey.user_b_comfortable end,
    'comfortable_by_them', case when caller_is_a then journey.user_b_comfortable else journey.user_a_comfortable end,
    'paused', journey.paused,
    'updated_at', journey.updated_at
  );
end;
$$;

create or replace function public.confirm_match_journey(target_match_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  member_a uuid;
  journey public.match_journeys%rowtype;
begin
  select m.user_a into member_a from public.matches m
    where m.id = target_match_id and (m.user_a = caller or m.user_b = caller);
  if not found then raise exception 'Match not found.'; end if;
  select * into journey from public.match_journeys where match_id = target_match_id for update;
  if journey.paused or journey.step <> 1 then raise exception 'This journey is not ready for confirmation.'; end if;
  if caller = member_a then
    update public.match_journeys set user_a_confirmed = true, updated_at = now() where match_id = target_match_id;
  else
    update public.match_journeys set user_b_confirmed = true, updated_at = now() where match_id = target_match_id;
  end if;
  update public.match_journeys set step = 2, updated_at = now()
    where match_id = target_match_id and user_a_confirmed and user_b_confirmed;
end;
$$;

create or replace function public.mark_meeting_outcome(target_match_id uuid, outcome text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  member_a uuid;
  journey public.match_journeys%rowtype;
begin
  if outcome not in ('met', 'comfortable') then raise exception 'Invalid journey update.'; end if;
  select m.user_a into member_a from public.matches m
    where m.id = target_match_id and (m.user_a = caller or m.user_b = caller);
  if not found then raise exception 'Match not found.'; end if;
  select * into journey from public.match_journeys where match_id = target_match_id for update;
  if journey.paused then raise exception 'This journey is paused.'; end if;
  if outcome = 'met' then
    if journey.step <> 2 then raise exception 'Both users must confirm before a meeting.'; end if;
    if not exists (select 1 from public.meeting_proposals p where p.match_id = target_match_id and p.status = 'accepted') then
      raise exception 'An accepted public meeting proposal is required.';
    end if;
    if caller = member_a then update public.match_journeys set user_a_met = true, updated_at = now() where match_id = target_match_id;
    else update public.match_journeys set user_b_met = true, updated_at = now() where match_id = target_match_id; end if;
    update public.match_journeys set step = 3 where match_id = target_match_id and user_a_met and user_b_met;
    update public.meeting_proposals set status = 'completed' where match_id = target_match_id and status = 'accepted'
      and exists (select 1 from public.match_journeys j where j.match_id = target_match_id and j.step = 3);
  else
    if journey.step <> 3 or not journey.user_a_met or not journey.user_b_met then raise exception 'Both users must mark the meeting complete first.'; end if;
    if caller = member_a then update public.match_journeys set user_a_comfortable = true, updated_at = now() where match_id = target_match_id;
    else update public.match_journeys set user_b_comfortable = true, updated_at = now() where match_id = target_match_id; end if;
  end if;
end;
$$;

create or replace function public.propose_meeting(target_match_id uuid, meeting_place text, meeting_time timestamptz)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  new_proposal_id uuid;
begin
  if not public.is_match_member(target_match_id) then raise exception 'Match not found.'; end if;
  if not exists (select 1 from public.match_journeys j where j.match_id = target_match_id and j.step = 2 and not j.paused and j.user_a_confirmed and j.user_b_confirmed) then
    raise exception 'Both users must confirm before proposing a meeting.';
  end if;
  if meeting_time <= now() or char_length(trim(meeting_place)) < 2 or char_length(meeting_place) > 200 then
    raise exception 'Provide a public place and a future date and time.';
  end if;
  insert into public.meeting_proposals (match_id, proposed_by, place, proposed_at)
    values (target_match_id, caller, trim(meeting_place), meeting_time) returning id into new_proposal_id;
  return new_proposal_id;
end;
$$;

create or replace function public.respond_to_meeting(target_proposal_id uuid, accepted boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  proposal public.meeting_proposals%rowtype;
begin
  select p.* into proposal from public.meeting_proposals p
    where p.id = target_proposal_id and public.is_match_member(p.match_id) for update;
  if not found or proposal.proposed_by = caller or proposal.status <> 'pending' then
    raise exception 'Meeting proposal is not available to respond to.';
  end if;
  if not exists (select 1 from public.match_journeys j where j.match_id = proposal.match_id and j.step = 2 and not j.paused) then
    raise exception 'This journey is not ready for a meeting.';
  end if;
  update public.meeting_proposals set status = case when accepted then 'accepted' else 'declined' end
    where id = target_proposal_id;
end;
$$;

create or replace function public.mark_match_messages_read(target_match_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_match_member(target_match_id) then raise exception 'Match not found.'; end if;
  update public.messages set read_at = now()
    where match_id = target_match_id and recipient_id = (select auth.uid()) and read_at is null;
end;
$$;

create or replace function public.unmatch_user(target_user_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  delete from public.matches m where
    ((m.user_a = caller and m.user_b = target_user_id) or (m.user_b = caller and m.user_a = target_user_id));
  if not found then raise exception 'Match not found.'; end if;
end;
$$;

create or replace function public.admin_review_verification(target_request_id uuid, approved boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  if not public.is_roomie_admin() then raise exception 'Admin access required.'; end if;
  update public.verification_requests set status = case when approved then 'approved' else 'rejected' end,
    reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = target_request_id returning user_id into target_user_id;
  if target_user_id is null then raise exception 'Verification request not found.'; end if;
  update public.profiles set is_verified = approved, updated_at = now() where id = target_user_id;
  insert into public.audit_log (admin_id, action, target_type, target_id, details)
    values ((select auth.uid()), case when approved then 'approve_verification' else 'reject_verification' end,
      'verification_request', target_request_id, '{}'::jsonb);
end;
$$;

create or replace function public.protect_profile_trusted_fields()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_roomie_admin() and (
    new.is_verified is distinct from old.is_verified or
    new.is_suspended is distinct from old.is_suspended or
    new.accepted_18_at is distinct from old.accepted_18_at
  ) then
    raise exception 'Trusted profile fields can only be changed by ROOMIE administrators.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_profile_trusted_fields
  before update on public.profiles
  for each row execute function public.protect_profile_trusted_fields();

create or replace function public.notify_saved_profile()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, actor_id, kind)
    values (new.profile_id, new.user_id, 'save');
  return new;
end;
$$;
create trigger on_profile_saved
  after insert on public.saved_profiles
  for each row execute function public.notify_saved_profile();

create or replace function public.notify_new_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, actor_id, kind)
    values (new.recipient_id, new.sender_id, 'message');
  return new;
end;
$$;
create trigger on_message_sent
  after insert on public.messages
  for each row execute function public.notify_new_message();

create or replace function public.remove_match_on_block()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.matches m where
    m.user_a = least(new.blocker_id, new.blocked_id) and
    m.user_b = greatest(new.blocker_id, new.blocked_id);
  delete from public.likes l where
    (l.user_id = new.blocker_id and l.target_id = new.blocked_id) or
    (l.user_id = new.blocked_id and l.target_id = new.blocker_id);
  return new;
end;
$$;
create trigger on_profile_blocked
  after insert on public.blocks
  for each row execute function public.remove_match_on_block();

create or replace function public.protect_listing_trusted_fields()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_roomie_admin() and (
    new.owner_id is distinct from old.owner_id or
    new.verified_at is distinct from old.verified_at
  ) then
    raise exception 'Listing verification and ownership can only be changed by ROOMIE administrators.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger protect_listing_trusted_fields
  before update on public.property_listings
  for each row execute function public.protect_listing_trusted_fields();

create or replace function public.audit_listing_verification()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if public.is_roomie_admin() and new.verified_at is distinct from old.verified_at then
    insert into public.audit_log (admin_id, action, target_type, target_id, details)
      values ((select auth.uid()), case when new.verified_at is null then 'unverify_listing' else 'verify_listing' end,
        'listing', new.id, '{}'::jsonb);
  end if;
  return new;
end;
$$;
create trigger audit_listing_verification
  after update on public.property_listings
  for each row execute function public.audit_listing_verification();

create or replace function public.submit_report(target_user_id uuid, report_reason text, report_details text default '')
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  new_report_id uuid;
begin
  if caller is null or target_user_id = caller then raise exception 'Invalid report target.'; end if;
  if char_length(trim(report_reason)) < 2 or char_length(report_reason) > 100 or char_length(report_details) > 2000 then
    raise exception 'Please provide a valid report reason and details.';
  end if;
  if (select count(*) from public.reports where reporter_id = caller and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Report limit reached. Please try again later.';
  end if;
  insert into public.reports (reporter_id, reported_user_id, reason, details)
    values (caller, target_user_id, trim(report_reason), trim(report_details)) returning id into new_report_id;
  update public.match_journeys j set paused = true, updated_at = now()
    from public.matches m where j.match_id = m.id and
    ((m.user_a = caller and m.user_b = target_user_id) or (m.user_b = caller and m.user_a = target_user_id));
  return new_report_id;
end;
$$;

create or replace function public.admin_set_suspended(target_user_id uuid, suspend_user boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_roomie_admin() then raise exception 'Admin access required.'; end if;
  update public.profiles set is_suspended = suspend_user, is_visible = not suspend_user, updated_at = now()
    where id = target_user_id;
  insert into public.audit_log (admin_id, action, target_type, target_id, details)
    values ((select auth.uid()), case when suspend_user then 'suspend_user' else 'restore_user' end, 'profile', target_user_id, '{}'::jsonb);
end;
$$;

create or replace function public.admin_review_report(target_report_id uuid, next_status text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_roomie_admin() then raise exception 'Admin access required.'; end if;
  if next_status not in ('reviewing', 'resolved', 'dismissed') then raise exception 'Invalid report status.'; end if;
  update public.reports set status = next_status where id = target_report_id;
  insert into public.audit_log (admin_id, action, target_type, target_id, details)
    values ((select auth.uid()), 'review_report', 'report', target_report_id, jsonb_build_object('status', next_status));
end;
$$;

alter table public.profiles enable row level security;
create policy "Profiles readable to self or discover" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (
    is_visible and age >= 18 and not is_suspended and not public.is_roomie_admin() and
    not public.is_blocked_with(id)
  ) or public.is_roomie_admin());
create policy "Profile owner inserts own adult profile" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and age >= 18 and not is_suspended and not is_verified);
create policy "Profile owner updates own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()) and age >= 18 and not is_suspended);
create policy "Admin manages profiles" on public.profiles for all to authenticated
  using (public.is_roomie_admin()) with check (public.is_roomie_admin());
revoke all on public.profiles from anon, authenticated;
grant select (id, full_name, age, profession, city, areas, bio, photo_url, budget_min, budget_max,
  move_in_date, room_type, lifestyle, hide_exact_locality, is_visible, created_at, updated_at) on public.profiles to authenticated;
grant update (full_name, age, profession, city, areas, bio, photo_url, budget_min, budget_max,
  move_in_date, room_type, lifestyle, hide_exact_locality, is_visible, updated_at) on public.profiles to authenticated;

alter table public.profile_photos enable row level security;
create policy "Photo metadata visible to owner and discover viewers" on public.profile_photos for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = user_id and p.is_visible and not p.is_suspended));
create policy "Owner manages profile photo metadata" on public.profile_photos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.accommodation_preferences enable row level security;
create policy "Owner manages accommodation preferences" on public.accommodation_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.lifestyle_preferences enable row level security;
create policy "Owner manages lifestyle preferences" on public.lifestyle_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.preferred_areas enable row level security;
create policy "Owner manages preferred areas" on public.preferred_areas for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.likes enable row level security;
create policy "Participants read likes received or sent" on public.likes for select to authenticated
  using (user_id = (select auth.uid()) or target_id = (select auth.uid()));
alter table public.matches enable row level security;
create policy "Only match participants can read match" on public.matches for select to authenticated using (user_a = (select auth.uid()) or user_b = (select auth.uid()));

alter table public.match_journeys enable row level security;
create policy "Match participants can read journey" on public.match_journeys for select to authenticated using (public.is_match_member(match_id));
alter table public.meeting_proposals enable row level security;
create policy "Match participants read meeting proposals" on public.meeting_proposals for select to authenticated
  using (public.is_match_member(match_id));

alter table public.messages enable row level security;
create policy "Match participants read chat messages" on public.messages for select to authenticated
  using (public.is_match_member(match_id) and not exists (
    select 1 from public.blocks b where
      (b.blocker_id = (select auth.uid()) and b.blocked_id = recipient_id) or
      (b.blocker_id = recipient_id and b.blocked_id = (select auth.uid()))
  ));
create policy "Match members send own messages" on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid()) and public.is_match_member(match_id) and exists (
      select 1 from public.matches m where m.id = match_id and
      ((m.user_a = sender_id and m.user_b = recipient_id) or (m.user_b = sender_id and m.user_a = recipient_id))
    ) and not exists (select 1 from public.blocks b where
      (b.blocker_id = sender_id and b.blocked_id = recipient_id) or
      (b.blocker_id = recipient_id and b.blocked_id = sender_id))
  );
alter table public.saved_profiles enable row level security;
create policy "Saved profiles private to owner" on public.saved_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.property_listings enable row level security;
create policy "Active listings readable" on public.property_listings for select to authenticated
  using ((status = 'active' and exists (select 1 from public.profiles p where p.id = owner_id and not p.is_suspended)) or owner_id = (select auth.uid()) or public.is_roomie_admin());
create policy "Listing owner manages own listings" on public.property_listings for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Listing owner updates own listings" on public.property_listings for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Admin manages listings" on public.property_listings for all to authenticated
  using (public.is_roomie_admin()) with check (public.is_roomie_admin());
create policy "Listing owner or admin removes listing" on public.property_listings for delete to authenticated
  using (owner_id = (select auth.uid()) or public.is_roomie_admin());
alter table public.property_images enable row level security;
create policy "Property image metadata visible with listing" on public.property_images for select to authenticated
  using (exists (select 1 from public.property_listings l where l.id = listing_id and (l.status = 'active' or l.owner_id = (select auth.uid()))));
create policy "Listing owner manages image metadata" on public.property_images for all to authenticated
  using (exists (select 1 from public.property_listings l where l.id = listing_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.property_listings l where l.id = listing_id and l.owner_id = (select auth.uid())));

alter table public.reports enable row level security;
create policy "Reporter and admin can read reports" on public.reports for select to authenticated using (reporter_id = (select auth.uid()) or public.is_roomie_admin());
create policy "Only admin updates reports" on public.reports for update to authenticated using (public.is_roomie_admin()) with check (public.is_roomie_admin());
revoke insert on public.reports from anon, authenticated;
alter table public.blocks enable row level security;
create policy "Block owner manages own blocks" on public.blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));
alter table public.verification_requests enable row level security;
create policy "User creates and reads own verification request" on public.verification_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_roomie_admin());
create policy "User submits own verification request" on public.verification_requests for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Admin reviews verification requests" on public.verification_requests for update to authenticated using (public.is_roomie_admin()) with check (public.is_roomie_admin());
alter table public.notifications enable row level security;
create policy "User manages own notifications" on public.notifications for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.saved_filters enable row level security;
create policy "User manages own filters" on public.saved_filters for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.admin_roles enable row level security;
create policy "User reads own admin role" on public.admin_roles for select to authenticated using (user_id = (select auth.uid()));
alter table public.audit_log enable row level security;
create policy "Admin reads audit log" on public.audit_log for select to authenticated using (public.is_roomie_admin());
alter table public.testimonials enable row level security;
create policy "Visitors read approved testimonials" on public.testimonials for select to anon, authenticated using (approved);
create policy "Admin manages testimonials" on public.testimonials for all to authenticated
  using (public.is_roomie_admin()) with check (public.is_roomie_admin());
alter table public.ai_requests enable row level security;
create policy "AI request counts private to owner" on public.ai_requests for select to authenticated using (user_id = (select auth.uid()));

revoke all on function public.is_roomie_admin() from public, anon;
revoke all on function public.is_match_member(uuid) from public, anon;
revoke all on function public.is_blocked_with(uuid) from public, anon;
revoke all on function public.record_like(uuid, text) from public, anon;
revoke all on function public.get_match_journey(uuid) from public, anon;
revoke all on function public.confirm_match_journey(uuid) from public, anon;
revoke all on function public.mark_meeting_outcome(uuid, text) from public, anon;
revoke all on function public.propose_meeting(uuid, text, timestamptz) from public, anon;
revoke all on function public.respond_to_meeting(uuid, boolean) from public, anon;
revoke all on function public.mark_match_messages_read(uuid) from public, anon;
revoke all on function public.unmatch_user(uuid) from public, anon;
revoke all on function public.submit_report(uuid, text, text) from public, anon;
revoke all on function public.admin_set_suspended(uuid, boolean) from public, anon;
revoke all on function public.admin_review_report(uuid, text) from public, anon;
revoke all on function public.admin_review_verification(uuid, boolean) from public, anon;

grant execute on function public.is_roomie_admin() to authenticated;
grant execute on function public.is_match_member(uuid) to authenticated;
grant execute on function public.is_blocked_with(uuid) to authenticated;
grant execute on function public.record_like(uuid, text) to authenticated;
grant execute on function public.get_match_journey(uuid) to authenticated;
grant execute on function public.confirm_match_journey(uuid) to authenticated;
grant execute on function public.mark_meeting_outcome(uuid, text) to authenticated;
grant execute on function public.submit_report(uuid, text, text) to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean) to authenticated;
grant execute on function public.admin_review_report(uuid, text) to authenticated;
grant execute on function public.propose_meeting(uuid, text, timestamptz) to authenticated;
grant execute on function public.respond_to_meeting(uuid, boolean) to authenticated;
grant execute on function public.mark_match_messages_read(uuid) to authenticated;
grant execute on function public.unmatch_user(uuid) to authenticated;
grant execute on function public.mark_meeting_outcome(uuid, text) to authenticated;
grant execute on function public.admin_review_verification(uuid, boolean) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Profile photos are publicly readable" on storage.objects for select
  using (bucket_id = 'profile-photos');
create policy "User uploads only to own profile folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "User updates only own profile photos" on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "User deletes only own profile photos" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.match_journeys;
alter publication supabase_realtime add table public.meeting_proposals;
