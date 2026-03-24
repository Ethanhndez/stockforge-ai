import { NextRequest, NextResponse } from 'next/server'
import { runPortfolioAnalysisPipeline } from '@/lib/portfolio/portfolioAnalysisPipeline'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, createClientWithAccessToken } from '@/lib/supabase/server'

function isMissingAgentDecisionsTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("Could not find the table 'public.agent_decisions'") ||
    message.includes("Could not find the 'stage_durations' column of 'agent_decisions'")
  )
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? ''
  const supabase = await createClient()
  let pipelineSupabase = supabase
  const authHeader = req.headers.get('authorization')
  let {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    if (token) {
      const admin = createAdminClient()
      const { data, error } = await admin.auth.getUser(token)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      user = data.user
      pipelineSupabase = createClientWithAccessToken(token)
    }
  }

  if (!user) {
    if (!contentType.includes('application/json')) {
      const redirectUrl = new URL('/login', req.url)
      redirectUrl.searchParams.set('next', '/lab')
      return NextResponse.redirect(redirectUrl)
    }
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let portfolioId = ''

  if (contentType.includes('application/json')) {
    const body = (await req.json()) as { portfolioId?: string }
    portfolioId = body.portfolioId?.trim() ?? ''
  } else {
    const formData = await req.formData()
    portfolioId = String(formData.get('portfolioId') ?? '').trim()
  }

  if (!portfolioId) {
    return NextResponse.json({ error: 'portfolioId is required' }, { status: 400 })
  }

  try {
    const result = await runPortfolioAnalysisPipeline(user.id, portfolioId, pipelineSupabase)

    if (!contentType.includes('application/json')) {
      const redirectUrl = new URL('/lab', req.url)
      redirectUrl.searchParams.set('run', 'success')
      redirectUrl.searchParams.set('decisionId', result.decisionId)
      return NextResponse.redirect(redirectUrl)
    }

    return NextResponse.json(result)
  } catch (error) {
    const missingTable = isMissingAgentDecisionsTableError(error)
    const message = missingTable
      ? 'Phase 2 setup is incomplete: apply supabase/migrations/20260323000000_agent_decisions.sql and supabase/migrations/20260323110000_agent_decisions_stage_durations.sql to the target Supabase project.'
      : error instanceof Error
        ? error.message
        : 'Pipeline failed'

    if (!contentType.includes('application/json')) {
      const redirectUrl = new URL('/lab', req.url)
      redirectUrl.searchParams.set('run', 'error')
      redirectUrl.searchParams.set('message', message)
      return NextResponse.redirect(redirectUrl)
    }

    return NextResponse.json({ error: message }, { status: missingTable ? 503 : 500 })
  }
}
