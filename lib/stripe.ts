import Stripe from "stripe"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set")
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    })
  }
  return _stripe
}

export function getPriceToPlan(): Record<string, string> {
  return {
    [process.env.NEXT_PUBLIC_PREMIUM_PRICE_ID ?? ""]:      "premium",
    [process.env.NEXT_PUBLIC_PREMIUM_PLUS_PRICE_ID ?? ""]: "premium_plus",
  }
}
