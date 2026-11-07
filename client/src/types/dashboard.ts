export type RiskCategory = 'LOW' | 'MEDIUM' | 'HIGH'

export type TransactionStatus = 'PENDING' | 'APPROVED' | 'DECLINED'

export interface FamilyTransaction {
  id: string
  elderName: string
  elderRelation: string
  elderAge?: number
  payee: string
  amount: number
  purpose: string
  timestamp: string
  date: string
  riskScore: number // 0 to 100
  riskCategory: RiskCategory
  aiExplanation: string
  flaggedReasons: string[]
  verificationSteps: string[]
  questionsToConsider: string[]
  status: TransactionStatus
  reviewedAt?: string
  decisionNote?: string
}

export interface DashboardStats {
  pendingCount: number
  approvedCount: number
  declinedCount: number
  totalProtectedAmount: number
}

export type DashboardNavTab = 'overview' | 'pending' | 'history' | 'members' | 'settings'

export interface FamilyMember {
  id: string
  name: string
  relation: string
  age: number
  phone: string
  protectionStatus: 'ACTIVE' | 'PAUSED'
  monthlyLimit: number
  requiresApprovalAbove: number
  activeDevices: number
}

