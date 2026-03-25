import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Barlow_Condensed } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: {
    default: "RepAI — Suivi & Performance",
    template: "%s | RepAI",
  },
  description: "Trackez vos séances, visualisez vos progrès et progressez avec votre coach IA.",
  keywords: ["musculation", "fitness", "suivi", "performance", "coach IA"],
  authors: [{ name: "RepAI" }],
  openGraph: {
    title: "RepAI — Suivi & Performance",
    description: "Trackez vos séances, visualisez vos progrès et progressez avec votre coach IA.",
    siteName: "RepAI",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RepAI — Suivi & Performance",
    description: "Trackez vos séances, visualisez vos progrès et progressez avec votre coach IA.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${barlowCondensed.variable} font-[family-name:var(--font-jakarta)] antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
