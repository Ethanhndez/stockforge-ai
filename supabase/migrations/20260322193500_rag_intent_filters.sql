-- ============================================================
-- supabase/migrations/20260322193500_rag_intent_filters.sql
-- StockForge AI — intent-aware provenance and visibility filters
-- ============================================================

drop function if exists match_research_documents(vector(1536), float, int);
drop function if exists match_research_documents(vector(1536), float, int, text[], text[]);

create or replace function match_research_documents(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5,
  allowed_provenance_classes text[] default null,
  allowed_visibility text[] default null
)
returns table (
  id uuid,
  title text,
  type text,
  source_url text,
  content text,
  tags text[],
  metadata jsonb,
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
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from research_documents
  where 1 - (embedding <=> query_embedding) > match_threshold
    and (
      allowed_provenance_classes is null
      or coalesce(metadata->>'provenance_class', 'reference') = any(allowed_provenance_classes)
    )
    and (
      allowed_visibility is null
      or coalesce(metadata->>'visibility', 'reference') = any(allowed_visibility)
    )
  order by embedding <=> query_embedding
  limit match_count;
$$;
