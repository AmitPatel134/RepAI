import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ connected: false })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ connected: false })

    const token = await prisma.stravaToken.findUnique({ where: { userId: user.id } })
    return Response.json({ connected: !!token, athleteId: token?.stravaAthleteId ?? null })
  } catch {
    return Response.json({ connected: false })
  }
}
