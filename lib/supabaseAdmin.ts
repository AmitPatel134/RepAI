import { createClient } from "@supabase/supabase-js"

// Admin client requires SUPABASE_SERVICE_ROLE_KEY (secret — never expose client-side)
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null
