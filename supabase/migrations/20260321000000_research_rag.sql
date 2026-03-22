-- ============================================================
-- supabase/migrations/20260321000000_research_rag.sql
-- StockForge AI — RAG pipeline: research_documents + pgvector
-- ============================================================

-- Enable pgvector extension
create extension if not exists vector;

-- Research documents table for RAG
create table if not exists research_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null check (type in ('research_paper', 'code_repo', 'article')),
  source_url text,
  content text not null,
  tags text[] default '{}',
  chunk_index integer default 0,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Index for fast vector similarity search
create index if not exists research_documents_embedding_idx
  on research_documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- RPC function for cosine similarity search
create or replace function match_research_documents(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  type text,
  source_url text,
  content text,
  tags text[],
  similarity float
)
language sql stable
as $$
  select
    id,
    title,
    type,
    source_url,
    content,
    tags,
    1 - (embedding <=> query_embedding) as similarity
  from research_documents
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ── RLS ─────────────────────────────────────────────────────
alter table research_documents enable row level security;

create policy "authenticated users can read research"
  on research_documents for select
  to authenticated
  using (true);

create policy "service role full access"
  on research_documents for all
  to service_role
  using (true);
