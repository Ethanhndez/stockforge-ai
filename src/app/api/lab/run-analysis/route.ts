import { NextRequest, NextResponse } from 'next/server'
import { runPortfolioAnalysisPipeline } from '@/lib/portfolio/portfolioAnalysisPipeline'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let portfolioId = ''

  const contentType = req.headers.get('content-type') ?? ''

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
    const result = await runPortfolioAnalysisPipeline(user.id, portfolioId)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 }
    )
  }
}
