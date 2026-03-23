import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ensurePortfolioWorkspace } from '@/lib/portfolio/server'

interface AgentDecisionListRow {
  id: string
  run_at: string
  proposal_status: 'pending' | 'accepted' | 'rejected' | 'expired'
  proposal: object | null
}

export const dynamic = 'force-dynamic'

export default async function LabPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/lab')
  }

  const { investment } = await ensurePortfolioWorkspace(user.id)

  const { data: decisions, error } = await supabase
    .from('agent_decisions')
    .select('id, run_at, proposal_status, proposal')
    .eq('user_id', user.id)
    .eq('portfolio_id', investment.id)
    .order('run_at', { ascending: false })
    .limit(5)
    .returns<AgentDecisionListRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return (
    <main style={{ padding: 24, fontFamily: 'monospace' }}>
      <h1>Lab Operator Console</h1>
      <p>Portfolio: {investment.name}</p>

      <form action="/api/lab/run-analysis" method="post" style={{ marginBottom: 24 }}>
        <input type="hidden" name="portfolioId" value={investment.id} />
        <button type="submit">Run Analysis</button>
      </form>

      <h2>Recent Decisions</h2>
      {decisions && decisions.length > 0 ? (
        <ul>
          {decisions.map((decision) => (
            <li key={decision.id}>
              {decision.run_at} | status: {decision.proposal_status} | proposal:{' '}
              {decision.proposal ? 'yes' : 'no'}
            </li>
          ))}
        </ul>
      ) : (
        <p>No agent decisions recorded yet.</p>
      )}
    </main>
  )
}
