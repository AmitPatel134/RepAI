import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: {
    default: "MyApp — AI-powered SaaS",
    template: "%s | MyApp",
  },
  description: "The AI-powered platform to manage your workflow efficiently.",
  keywords: ["SaaS", "AI", "productivity", "management"],
  authors: [{ name: "MyApp" }],
  openGraph: {
    title: "MyApp — AI-powered SaaS",
    description: "The AI-powered platform to manage your workflow efficiently.",
    url: "https://example.com",
    siteName: "MyApp",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyApp — AI-powered SaaS",
    description: "The AI-powered platform to manage your workflow efficiently.",
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
      <body className={`${jakarta.variable} font-[family-name:var(--font-jakarta)] antialiased bg-white text-gray-900`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
