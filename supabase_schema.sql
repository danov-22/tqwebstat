-- TQ Web Stats: run once in Supabase Dashboard > SQL Editor.
-- Authentication remains username/password in the UI. The app maps usernames
-- to private synthetic Auth emails; only the display username is exposed.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_key text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 3 and 64)
);

create table public.daily_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  stat_date date not null,
  ql integer not null default 0 check (ql >= 0),
  vm integer not null default 0 check (vm >= 0),
  snr integer not null default 0 check (snr >= 0),
  ni integer not null default 0 check (ni >= 0),
  hu integer not null default 0 check (hu >= 0),
  dnc integer not null default 0 check (dnc >= 0),
  ooo integer not null default 0 check (ooo >= 0),
  lb integer not null default 0 check (lb >= 0),
  fe integer not null default 0 check (fe >= 0),
  wn integer not null default 0 check (wn >= 0),
  fp integer not null default 0 check (fp >= 0),
  mp integer not null default 0 check (mp >= 0),
  primary key (user_id, stat_date)
);

create table public.ql_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stat_date date not null,
  lead_number integer not null check (lead_number > 0),
  note text not null default '' check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  unique (user_id, stat_date, lead_number) deferrable initially deferred
);

create index daily_stats_user_date_idx on public.daily_stats (user_id, stat_date);
create index ql_notes_user_date_idx on public.ql_notes (user_id, stat_date, lead_number);

alter table public.profiles enable row level security;
alter table public.daily_stats enable row level security;
alter table public.ql_notes enable row level security;

create policy "Users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users read own stats" on public.daily_stats for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users read own notes" on public.ql_notes for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.create_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text := trim(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  if char_length(v_username) < 3 or char_length(v_username) > 64 then
    raise exception 'Username must be between 3 and 64 characters.';
  end if;
  insert into public.profiles (id, username, username_key)
  values (new.id, v_username, lower(v_username));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.create_profile();

create or replace function public.record_stat(
  p_date date, p_category text, p_delta integer, p_fp boolean default false,
  p_mp boolean default false, p_note text default ''
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_lead integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_category not in ('ql','vm','snr','ni','hu','dnc','ooo','lb','fe','wn') or p_delta not in (-1, 1) then
    raise exception 'Invalid stat update';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text || p_date::text));
  insert into daily_stats (user_id, stat_date) values (v_user, p_date) on conflict do nothing;
  update daily_stats set
    ql = greatest(0, ql + case when p_category = 'ql' then p_delta else 0 end),
    vm = greatest(0, vm + case when p_category = 'vm' then p_delta else 0 end),
    snr = greatest(0, snr + case when p_category = 'snr' then p_delta else 0 end),
    ni = greatest(0, ni + case when p_category = 'ni' then p_delta else 0 end),
    hu = greatest(0, hu + case when p_category = 'hu' then p_delta else 0 end),
    dnc = greatest(0, dnc + case when p_category = 'dnc' then p_delta else 0 end),
    ooo = greatest(0, ooo + case when p_category = 'ooo' then p_delta else 0 end),
    lb = greatest(0, lb + case when p_category = 'lb' then p_delta else 0 end),
    fe = greatest(0, fe + case when p_category = 'fe' then p_delta else 0 end),
    wn = greatest(0, wn + case when p_category = 'wn' then p_delta else 0 end),
    fp = greatest(0, fp + case when p_fp then p_delta else 0 end),
    mp = greatest(0, mp + case when p_mp then p_delta else 0 end)
  where user_id = v_user and stat_date = p_date;
  if p_category = 'ql' and p_delta = 1 then
    select coalesce(max(lead_number), 0) + 1 into v_lead from ql_notes where user_id = v_user and stat_date = p_date;
    insert into ql_notes (user_id, stat_date, lead_number, note) values (v_user, p_date, v_lead, left(coalesce(p_note, ''), 280));
    return jsonb_build_object('success', true, 'leadNumber', v_lead);
  end if;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.undo_last_ql(p_date date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_note_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text || p_date::text));
  update daily_stats set ql = ql - 1, fp = greatest(0, fp - 1), mp = greatest(0, mp - 1)
    where user_id = v_user and stat_date = p_date and ql > 0;
  if not found then raise exception 'No Qualified Lead to undo.'; end if;
  select id into v_note_id from ql_notes where user_id = v_user and stat_date = p_date order by lead_number desc, created_at desc limit 1;
  if v_note_id is not null then delete from ql_notes where id = v_note_id; end if;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.delete_ql(p_date date, p_lead_number integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text || p_date::text));
  delete from ql_notes where user_id = v_user and stat_date = p_date and lead_number = p_lead_number;
  if not found then raise exception 'Qualified Lead was not found.'; end if;
  update daily_stats set ql = greatest(0, ql - 1) where user_id = v_user and stat_date = p_date;
  with numbered as (
    select id, row_number() over (order by lead_number, created_at)::integer as next_lead
    from ql_notes where user_id = v_user and stat_date = p_date
  ) update ql_notes n set lead_number = numbered.next_lead from numbered where n.id = numbered.id;
  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.record_stat(date, text, integer, boolean, boolean, text) from public;
revoke all on function public.undo_last_ql(date) from public;
revoke all on function public.delete_ql(date, integer) from public;
grant execute on function public.record_stat(date, text, integer, boolean, boolean, text) to authenticated;
grant execute on function public.undo_last_ql(date) to authenticated;
grant execute on function public.delete_ql(date, integer) to authenticated;
