import Navbar from '@/components/Navbar'
import PortfolioDashboardClient from '@/app/dashboard/PortfolioDashboardClient'
import {
  getPortfolioDashboardData,
  requireAuthenticatedUser,
} from '@/lib/portfolio/server'

export default async function DashboardPage() {
  const { user } = await requireAuthenticatedUser('/dashboard')
  const dashboard = await getPortfolioDashboardData(user.id)

  const userLabel =
    typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim().length > 0
      ? user.user_metadata.full_name.trim()
      : user.email ?? 'Portfolio operator'

  return (
    <>
      <Navbar />
      <PortfolioDashboardClient
        userLabel={userLabel}
        userId={user.id}
        portfolioId={dashboard.portfolio.id}
        portfolioName={dashboard.portfolio.name}
        benchmark={dashboard.portfolio.benchmark}
        riskTier={dashboard.portfolio.risk_tier}
        cashBalance={dashboard.cashBalance}
        totalValue={dashboard.totalValue}
        holdings={dashboard.holdings}
        sectorAllocations={dashboard.sectorAllocations}
        userSettings={dashboard.userSettings}
      />
    </>
  )
}
