export type PlanName = "free" | "premium" | "premium_plus"

export function isPro(plan: string): boolean {
  return plan === "pro" || plan === "premium" || plan === "premium_plus"
}

export function isPremiumPlus(plan: string): boolean {
  return plan === "premium_plus"
}

export function hasMacros(plan: string): boolean {
  return isPro(plan)
}

export function hasFullHistory(plan: string): boolean {
  return isPro(plan)
}

export function hasAdvancedAI(plan: string): boolean {
  return isPremiumPlus(plan)
}

export const PLAN_LABELS: Record<string, string> = {
  free: "Gratuit",
  premium: "Premium",
  premium_plus: "Premium+",
  pro: "Pro",
}
