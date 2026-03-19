import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { name, description, status } = body

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })
  if (!user) return Response.json({ error: "User not found" }, { status: 404 })

  const item = await prisma.item.findUnique({ where: { id } })
  if (!item || item.userId !== user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 })
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      name,
      description: description ?? null,
      status: status ?? "active",
    },
  })
  return Response.json(updated)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })
  if (!user) return Response.json({ error: "User not found" }, { status: 404 })

  const item = await prisma.item.findUnique({ where: { id } })
  if (!item || item.userId !== user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 })
  }

  await prisma.item.delete({ where: { id } })
  return Response.json({ success: true })
}
