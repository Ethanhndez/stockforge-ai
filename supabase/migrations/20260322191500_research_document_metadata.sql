-- ============================================================
-- supabase/migrations/20260322191500_research_document_metadata.sql
-- StockForge AI — provenance-aware metadata for research_documents
-- ============================================================

alter table research_documents
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update research_documents
set metadata = jsonb_strip_nulls(
  jsonb_build_object(
    'provenance_class',
      case
        when tags @> array['founder-notes']::text[] then 'founder_note'
        when tags @> array['external-reference']::text[] then 'external_reference'
        else 'reference'
      end,
    'source_kind',
      case
        when source_url ilike 'https://www.notion.so/%' then 'notion_page'
        when type = 'research_paper' then 'research_paper'
        when type = 'code_repo' then 'code_repository'
        else 'article'
      end,
    'visibility',
      case
        when tags @> array['founder-notes']::text[] then 'internal'
        else 'reference'
      end,
    'author',
      case
        when tags @> array['founder-notes']::text[] then 'Ethan Hernandez'
        else null
      end,
    'notion_page_id',
      (
        select replace(substring(tag from 'notion-page-id:(.+)$'), '-', '')
        from unnest(tags) as tag
        where tag like 'notion-page-id:%'
        limit 1
      )
  )
)
where metadata = '{}'::jsonb;

drop function if exists match_research_documents(vector(1536), float, int);

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
  order by embedding <=> query_embedding
  limit match_count;
$$;
