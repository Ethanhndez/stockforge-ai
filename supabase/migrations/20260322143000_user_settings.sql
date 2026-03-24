create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  risk_tolerance text
    check (risk_tolerance in ('conservative', 'moderate', 'aggressive') or risk_tolerance is null),
  automation_preference text
    check (
      automation_preference in ('research_only', 'guided', 'approval_required')
      or automation_preference is null
    ),
  investing_horizon text
    check (investing_horizon in ('short_term', 'medium_term', 'long_term') or investing_horizon is null),
  primary_goal text
    check (primary_goal in ('growth', 'income', 'preservation', 'balanced') or primary_goal is null),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_user_settings_updated_at
before update on public.user_settings
for each row
execute function public.set_row_updated_at();

alter table public.user_settings enable row level security;

create policy "users manage own settings"
  on public.user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
