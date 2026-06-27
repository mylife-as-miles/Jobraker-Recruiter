export const BILLING_ERROR_PATTERNS = [
  {
    pattern: /upgrade required/i,
    title: 'A subscription is required',
    subtitle: 'Subscribe to unlock AI sourcing, screening, and outreach for your open roles.',
    cta: 'Subscribe',
  },
  {
    pattern: /not enough credits/i,
    title: "You've run out of credits",
    subtitle: 'Upgrade for more candidate searches and outreach volume. Daily usage resets at 00:00 UTC.',
    cta: 'Upgrade plan',
  },
  {
    pattern: /subscription not active/i,
    title: 'Your subscription is inactive',
    subtitle: 'Reactivate your subscription to keep sourcing and outreach running.',
    cta: 'Reactivate',
  },
] as const

export type BillingErrorMatch = (typeof BILLING_ERROR_PATTERNS)[number]

export function matchBillingError(message: string): BillingErrorMatch | null {
  return BILLING_ERROR_PATTERNS.find(({ pattern }) => pattern.test(message)) ?? null
}
