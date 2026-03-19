import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"

export async function DELETE(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })

    await prisma.stravaToken.deleteMany({ where: { userId: user.id } })
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
