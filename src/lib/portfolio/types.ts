export type PortfolioType = 'investment' | 'watchlist'

export interface PortfolioRecord {
  id: string
  user_id: string
  name: string
  portfolio_type: PortfolioType
  inception_date: string | null
  benchmark: string | null
  risk_tier: 'conservative' | 'moderate' | 'aggressive' | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface HoldingRecord {
  id: string
  portfolio_id: string
  user_id: string
  ticker: string
  shares: number | string
  cost_basis: number | string | null
  added_at: string
  updated_at: string
  archived_at: string | null
}

export interface CashBalanceRecord {
  id: string
  portfolio_id: string
  user_id: string
  amount: number | string
  updated_at: string
}

export interface PortfolioDashboardHolding {
  id: string
  ticker: string
  shares: number
  costBasis: number | null
  currentPrice: number | null
  currentValue: number
  weight: number
  sector: string | null
}

export interface SectorAllocation {
  sector: string
  value: number
  weight: number
}

export interface PortfolioDashboardData {
  portfolio: PortfolioRecord
  watchlist: PortfolioRecord
  cashBalance: number
  holdings: PortfolioDashboardHolding[]
  totalValue: number
  sectorAllocations: SectorAllocation[]
  userSettings: UserSettingsRecord
}

export interface UserSettingsRecord {
  user_id: string
  full_name: string | null
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive' | null
  automation_preference: 'research_only' | 'guided' | 'approval_required' | null
  investing_horizon: 'short_term' | 'medium_term' | 'long_term' | null
  primary_goal: 'growth' | 'income' | 'preservation' | 'balanced' | null
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}
