import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pricing",
  description: "Start free with 5 items and 5 AI generations per month. Upgrade to Pro to remove all limits.",
  openGraph: {
    title: "Pricing — RepAI",
    description: "Start free. Pro plan with no commitment for unlimited items and generations.",
    url: "https://repai.fr/pricing",
  },
  twitter: {
    title: "Pricing — RepAI",
    description: "Free plan or Pro with no commitment.",
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
