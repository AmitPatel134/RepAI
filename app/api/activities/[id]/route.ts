import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })

    const activity = await prisma.activity.findFirst({ where: { id, userId: user.id } })
    if (!activity) return Response.json({ error: "Not found" }, { status: 404 })

    await prisma.activity.delete({ where: { id } })
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
