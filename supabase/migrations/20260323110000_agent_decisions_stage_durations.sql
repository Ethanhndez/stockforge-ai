alter table public.agent_decisions
add column if not exists stage_durations jsonb;
