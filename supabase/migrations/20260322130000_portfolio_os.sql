create extension if not exists "pgcrypto";

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  portfolio_type text not null default 'investment'
    check (portfolio_type in ('investment', 'watchlist')),
  inception_date date,
  benchmark text,
  risk_tier text
    check (risk_tier in ('conservative', 'moderate', 'aggressive') or risk_tier is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists portfolios_one_active_watchlist_per_user_idx
  on public.portfolios (user_id, portfolio_type)
  where portfolio_type = 'watchlist' and archived_at is null;

create index if not exists portfolios_user_id_idx
  on public.portfolios (user_id, created_at desc);

create trigger set_portfolios_updated_at
before update on public.portfolios
for each row
execute function public.set_row_updated_at();

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null check (ticker = upper(ticker)),
  shares numeric not null default 0 check (shares >= 0),
  cost_basis numeric check (cost_basis is null or cost_basis >= 0),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists holdings_one_active_ticker_per_portfolio_idx
  on public.holdings (portfolio_id, ticker)
  where archived_at is null;

create index if not exists holdings_user_id_idx
  on public.holdings (user_id, portfolio_id, ticker);

create trigger set_holdings_updated_at
before update on public.holdings
for each row
execute function public.set_row_updated_at();

create table if not exists public.cash_balance (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null unique references public.portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists cash_balance_user_id_idx
  on public.cash_balance (user_id, portfolio_id);

create trigger set_cash_balance_updated_at
before update on public.cash_balance
for each row
execute function public.set_row_updated_at();

create table if not exists public.allocation_targets (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null
    check (target_type in ('ticker', 'sector', 'asset_class')),
  target_key text not null,
  target_pct numeric not null check (target_pct >= 0 and target_pct <= 1),
  set_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists allocation_targets_user_id_idx
  on public.allocation_targets (user_id, portfolio_id, target_type);

create trigger set_allocation_targets_updated_at
before update on public.allocation_targets
for each row
execute function public.set_row_updated_at();

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text check (ticker is null or ticker = upper(ticker)),
  action text not null
    check (action in ('buy', 'sell', 'dividend', 'deposit', 'withdrawal')),
  shares numeric check (shares is null or shares >= 0),
  price_per_share numeric check (price_per_share is null or price_per_share >= 0),
  total_value numeric not null check (total_value >= 0),
  is_paper boolean not null default true,
  executed_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  check (
    (
      action in ('deposit', 'withdrawal')
      and ticker is null
    )
    or (
      action in ('buy', 'sell', 'dividend')
      and ticker is not null
    )
  )
);

create index if not exists transactions_user_id_idx
  on public.transactions (user_id, portfolio_id, executed_at desc);

create table if not exists public.portfolio_policies (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  max_position_pct numeric check (max_position_pct is null or (max_position_pct >= 0 and max_position_pct <= 1)),
  max_sector_pct numeric check (max_sector_pct is null or (max_sector_pct >= 0 and max_sector_pct <= 1)),
  prohibited_tickers text[] not null default '{}',
  required_tickers text[] not null default '{}',
  max_single_trade_value numeric check (max_single_trade_value is null or max_single_trade_value >= 0),
  automation_level text not null default 'research_only'
    check (automation_level in ('research_only', 'propose', 'hitl', 'autonomous')),
  created_by text not null default 'user'
    check (created_by in ('user', 'system_default', 'system')),
  check (effective_until is null or effective_until >= effective_from)
);

create index if not exists portfolio_policies_user_id_idx
  on public.portfolio_policies (user_id, portfolio_id, effective_from desc);

alter table public.portfolios enable row level security;
alter table public.holdings enable row level security;
alter table public.cash_balance enable row level security;
alter table public.allocation_targets enable row level security;
alter table public.transactions enable row level security;
alter table public.portfolio_policies enable row level security;

create policy "users manage own portfolios"
  on public.portfolios
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage own holdings"
  on public.holdings
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.portfolios
      where portfolios.id = holdings.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.portfolios
      where portfolios.id = holdings.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  );

create policy "users manage own cash balance"
  on public.cash_balance
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.portfolios
      where portfolios.id = cash_balance.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.portfolios
      where portfolios.id = cash_balance.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  );

create policy "users manage own allocation targets"
  on public.allocation_targets
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.portfolios
      where portfolios.id = allocation_targets.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.portfolios
      where portfolios.id = allocation_targets.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  );

create policy "users manage own transactions"
  on public.transactions
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.portfolios
      where portfolios.id = transactions.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.portfolios
      where portfolios.id = transactions.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  );

create policy "users manage own portfolio policies"
  on public.portfolio_policies
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.portfolios
      where portfolios.id = portfolio_policies.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.portfolios
      where portfolios.id = portfolio_policies.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  );
