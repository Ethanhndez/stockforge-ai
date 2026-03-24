create table if not exists public.agent_decisions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  run_at timestamptz not null default now(),
  pipeline_version text not null default 'v1',
  holdings_snapshot jsonb not null,
  policies_snapshot jsonb not null,
  research_summaries jsonb,
  policy_assessment jsonb,
  risk_report jsonb,
  proposal jsonb,
  proposal_status text not null default 'pending'
    check (proposal_status in ('pending', 'accepted', 'rejected', 'expired')),
  user_action_at timestamptz,
  simulated_outcome jsonb,
  agent_mode text not null default 'parallel',
  error_log jsonb
);

alter table public.agent_decisions enable row level security;

create policy "Users see own decisions"
  on public.agent_decisions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_agent_decisions_user_portfolio
  on public.agent_decisions (user_id, portfolio_id, run_at desc);
