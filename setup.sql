-- Expense Tracker database setup.
-- Uses the SAME Supabase project as Pay Tracker, so it can read your pay data.
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Safe to run again.

-- Every purchase, refund, payment and transfer. amount > 0 = money out, amount < 0 = money back.
-- kind: spend (counts toward spending), payment (card payment), transfer (between your own accounts),
--       income (pay deposits; pay comes from Pay Tracker instead), plan (instalment line / purchase moved to a plan), ignore.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  description text not null,
  merchant text,
  amount numeric(10,2) not null,
  category text,
  kind text not null default 'spend',
  account text,
  source text not null default 'manual',   -- import | manual | tap
  import_hash text,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, import_hash)
);
create index if not exists expenses_user_date on public.expenses (user_id, date);

-- "Always put this shop in this category" rules you set in the app.
create table if not exists public.spend_rules (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pattern text not null,
  category text not null,
  kind text not null default 'spend',
  primary key (user_id, pattern)
);

-- Column layouts for each bank's statement file, remembered after the first import.
create table if not exists public.import_layouts (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  signature text not null,
  name text not null,
  mapping jsonb not null,
  primary key (user_id, signature)
);

-- Instalment plans (e.g. Amex Plan It) and other fixed monthly payments.
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  monthly numeric(10,2) not null,
  start_month date not null,      -- first day of the month of the first payment
  payments int not null,          -- how many monthly payments in total
  account text,
  note text
);

create table if not exists public.spend_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  take_home numeric(4,3) not null default 0.900,  -- share of job pay you keep after tax
  warn_at numeric(4,3) not null default 0.800,    -- warn when spending reaches this share of pay
  shortcut_token text unique
);

-- Expected pay per month, saved by the app so the Apple Pay shortcut can compare against it.
create table if not exists public.month_income (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month text not null,            -- YYYY-MM
  income numeric(10,2) not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

-- Categories you add yourself on the website. fixed = a once-a-month bill (not projected forward).
create table if not exists public.spend_categories (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  fixed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);

alter table public.expenses       enable row level security;
alter table public.spend_categories enable row level security;
alter table public.spend_rules    enable row level security;
alter table public.import_layouts enable row level security;
alter table public.plans          enable row level security;
alter table public.spend_settings enable row level security;
alter table public.month_income   enable row level security;

-- Each signed-in person can only see and change their own rows.
drop policy if exists "own expenses" on public.expenses;
create policy "own expenses" on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own spend rules" on public.spend_rules;
create policy "own spend rules" on public.spend_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own layouts" on public.import_layouts;
create policy "own layouts" on public.import_layouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own plans" on public.plans;
create policy "own plans" on public.plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own spend settings" on public.spend_settings;
create policy "own spend settings" on public.spend_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own categories" on public.spend_categories;
create policy "own categories" on public.spend_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own month income" on public.month_income;
create policy "own month income" on public.month_income for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Apple Pay shortcut: logs a tap and replies with how the month is going.
-- The iPhone Shortcut sends your private token (from Settings in the app) instead of a password.
create or replace function public.log_tap(token text, amount text, merchant text, card text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  amt numeric;
  today date := (now() at time zone 'America/Edmonton')::date;
  m_start date := date_trunc('month', (now() at time zone 'America/Edmonton'))::date;
  m_key text := to_char((now() at time zone 'America/Edmonton'), 'YYYY-MM');
  spent numeric;
  planned numeric;
  inc numeric;
  days_left int;
  per_day numeric;
  msg text;
begin
  if token is null or length(token) < 20 then return 'Expense Tracker: missing token.'; end if;
  select user_id into uid from spend_settings where shortcut_token = token;
  if uid is null then return 'Expense Tracker: token not recognised. Copy it again from Settings.'; end if;

  -- "$12.34", "CA$1,234.50", "12,34 $" → numbers
  amount := regexp_replace(coalesce(amount, ''), '[^0-9.,]', '', 'g');
  if amount ~ ',\d{2}$' and amount !~ '\.' then amount := replace(amount, ',', '.'); else amount := replace(amount, ',', ''); end if;
  amt := nullif(amount, '')::numeric;
  if amt is null or amt <= 0 then return 'Expense Tracker: could not read the amount.'; end if;

  insert into expenses (user_id, date, description, merchant, amount, category, kind, account, source)
  values (uid, today, coalesce(nullif(trim(merchant), ''), 'Apple Pay'), nullif(trim(merchant), ''), amt, null, 'spend',
          coalesce(nullif(trim(card), ''), 'Apple Pay'), 'tap');

  select coalesce(sum(e.amount), 0) into spent from expenses e
   where e.user_id = uid and e.kind = 'spend' and e.date >= m_start and e.date < (m_start + interval '1 month');
  select coalesce(sum(p.monthly), 0) into planned from plans p
   where p.user_id = uid and p.start_month <= m_start and m_start < (p.start_month + make_interval(months => p.payments));
  spent := spent + planned;
  select mi.income into inc from month_income mi where mi.user_id = uid and mi.month = m_key;

  msg := 'Logged ' || to_char(amt, 'FM$999,990.00') || coalesce(' at ' || nullif(trim(merchant), ''), '') || '. ';
  if inc is null or inc <= 0 then
    return msg || 'Spent ' || to_char(spent, 'FM$999,990') || ' this month.';
  end if;
  days_left := (m_start + interval '1 month')::date - today;
  per_day := (inc - spent) / greatest(days_left, 1);
  if spent >= inc then
    return '⚠️ ' || msg || 'You''ve spent ' || to_char(spent, 'FM$999,990') || ', more than the ' || to_char(inc, 'FM$999,990') || ' you''re getting paid this month.';
  elsif spent >= inc * (select coalesce(s.warn_at, 0.8) from spend_settings s where s.user_id = uid) then
    return '⚠️ ' || msg || to_char(spent, 'FM$999,990') || ' of ' || to_char(inc, 'FM$999,990') || ' pay used. Keep it to about ' || to_char(per_day, 'FM$999,990') || '/day.';
  end if;
  return msg || to_char(spent, 'FM$999,990') || ' of ' || to_char(inc, 'FM$999,990') || ' pay used · about ' || to_char(per_day, 'FM$999,990') || '/day left.';
end;
$$;
revoke all on function public.log_tap(text, text, text, text) from public;
grant execute on function public.log_tap(text, text, text, text) to anon, authenticated;
