import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })

    const meal = await prisma.meal.findFirst({ where: { id, userId: user.id } })
    if (!meal) return Response.json({ error: "Not found" }, { status: 404 })

    return Response.json(meal)
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })

    const meal = await prisma.meal.findFirst({ where: { id, userId: user.id } })
    if (!meal) return Response.json({ error: "Not found" }, { status: 404 })

    await prisma.meal.delete({ where: { id } })
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 })
  }
}
