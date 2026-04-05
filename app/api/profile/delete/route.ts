import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { createRateLimiter } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const rateLimit = createRateLimiter({ maxRequests: 3, windowMs: 60_000 })

export async function DELETE(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })

    // Delete all user data (cascade via Prisma schema relations)
    await prisma.user.delete({ where: { id: user.id } })

    // Delete Supabase auth account
    if (supabaseAdmin && authUser.id) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id)
    }

    return Response.json({ success: true })
  } catch (e) {
    console.error("[profile DELETE]", e)
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
