# SaaS Template

A production-ready Next.js SaaS template with authentication, AI generation, billing, and user management.

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Auth**: Supabase (email/password + Google OAuth)
- **Database**: PostgreSQL via Prisma ORM
- **Billing**: Stripe (subscriptions, billing portal, webhooks)
- **AI**: Groq SDK (llama-3.3-70b-versatile)
- **Email**: Resend
- **Styling**: Tailwind CSS v4 + shadcn/ui (base-nova)

## Features

- Free/Pro plan system with per-resource limits
- Item CRUD management
- AI content generation (text, email, summary, social)
- Generation history with filtering
- Stripe checkout + billing portal + webhooks
- Supabase auth with Google OAuth
- Rate limiting on API routes
- Onboarding modal for new users
- Responsive sidebar + mobile bottom nav
- Support contact form

## Getting Started

### 1. Clone and install

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`:
- **Supabase**: Create a project at [supabase.com](https://supabase.com)
- **Stripe**: Create an account and get your API keys at [stripe.com](https://stripe.com)
- **Groq**: Get an API key at [console.groq.com](https://console.groq.com)
- **Resend**: Get an API key at [resend.com](https://resend.com)

### 3. Set up the database

```bash
npx prisma generate
npx prisma db push
```

### 4. Configure Supabase Auth

In your Supabase project:
- Enable Email/Password authentication
- Enable Google OAuth (optional)
- Add redirect URLs: `http://localhost:3000/auth/callback`

### 5. Configure Stripe

- Create a subscription product and price in your Stripe dashboard
- Update `PRO_PRICE_ID` in `app/pricing/page.tsx` with your actual price ID
- Set up a webhook endpoint pointing to `/api/webhooks/stripe`
- Add the webhook secret to your `.env.local`

### 6. Customize the template

Search for `TODO` comments throughout the codebase for all customization points:

- **App name**: Update `APP_NAME` constant in:
  - `app/layout.tsx`
  - `app/page.tsx`
  - `app/pricing/page.tsx`
  - `components/AppSidebar.tsx`
  - `components/LoadingScreen.tsx`
  - `components/OnboardingModal.tsx`
  - `app/auth/reset/page.tsx`
  - `app/not-found.tsx`
  - `app/conditions/page.tsx`
  - `app/confidentialite/page.tsx`
  - `app/support/page.tsx`

- **Stripe price ID**: `app/pricing/page.tsx` → `PRO_PRICE_ID`
- **Pricing**: Update `$29` in `app/pricing/page.tsx` and `app/app/profil/page.tsx`
- **Support emails**: `app/api/support/route.ts` → `SUPPORT_FROM`, `SUPPORT_TO`
- **Welcome email**: `lib/email.ts` → update branding
- **Generation types**: `app/api/generate/route.ts` and `app/app/generation/page.tsx`
- **Legal pages**: `app/conditions/page.tsx` and `app/confidentialite/page.tsx`

### 7. Run locally

```bash
npm run dev
```

## Project Structure

```
app/
  page.tsx                    # Landing page
  layout.tsx                  # Root layout
  app/
    layout.tsx                # App shell (sidebar)
    page.tsx                  # Dashboard
    items/page.tsx            # Item CRUD
    generation/page.tsx       # AI generation
    profil/page.tsx           # User profile + billing
  api/
    dashboard/route.ts        # Dashboard data
    items/route.ts            # Items CRUD
    items/[id]/route.ts       # Item by ID
    generate/route.ts         # AI generation
    generations/route.ts      # Generation history
    generations/[id]/route.ts # Delete generation
    plan/route.ts             # Plan info + usage
    users/route.ts            # User profile
    users/plan/route.ts       # Update plan
    checkout/route.ts         # Stripe checkout
    checkout/verify/route.ts  # Payment verification
    billing-portal/route.ts   # Stripe billing portal
    cancel-subscription/route.ts
    webhooks/stripe/route.ts  # Stripe webhooks
    support/route.ts          # Support contact form
  auth/
    callback/page.tsx         # OAuth callback
    reset/page.tsx            # Password reset
  pricing/page.tsx            # Pricing page
  support/page.tsx            # Support page
  conditions/page.tsx         # Terms of service
  confidentialite/page.tsx    # Privacy policy
components/
  AppSidebar.tsx              # Navigation sidebar
  LoadingScreen.tsx           # Loading state
  OnboardingModal.tsx         # New user onboarding
  PlanBanner.tsx              # Plan usage bar
  Toast.tsx                   # Toast notifications
  ui/button.tsx               # shadcn Button
lib/
  authServer.ts               # Server-side JWT auth
  authFetch.ts                # Client-side auth fetch
  plans.ts                    # Plan definitions + limits
  prisma.ts                   # Prisma client singleton
  supabase.ts                 # Supabase client
  stripe.ts                   # Stripe client
  email.ts                    # Resend email helpers
  rate-limit.ts               # LRU cache rate limiter
  utils.ts                    # cn() utility
prisma/
  schema.prisma               # Database schema
```

## Plans

Edit `lib/plans.ts` to customize plan limits:

```typescript
export const PLANS = {
  free: { label: "Free", items: 5, generationsPerMonth: 5 },
  pro: { label: "Pro", items: Infinity, generationsPerMonth: Infinity },
}
```

## Deploying to Vercel

1. Push your repository to GitHub
2. Import project in Vercel
3. Add all environment variables from `.env.example`
4. Update `NEXT_PUBLIC_APP_URL` to your production URL
5. Update Supabase redirect URLs to include your production domain
6. Update Stripe webhook endpoint to your production URL
