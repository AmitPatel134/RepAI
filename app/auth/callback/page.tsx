"use client"
import { useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function AuthCallbackPage() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user?.email) {
        await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: session.user.email,
            name: session.user.user_metadata?.full_name ?? session.user.email.split("@")[0],
          }),
        })
        window.location.href = "/app"
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-violet-700 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white font-semibold text-sm">Signing in...</p>
      </div>
    </div>
  )
}
