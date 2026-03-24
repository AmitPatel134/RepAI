import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })
  if (!user) return Response.json([])

  const entries = await prisma.weightEntry.findMany({
    where: { userId: user.id },
    orderBy: { recordedAt: "asc" },
    select: { id: true, weightKg: true, recordedAt: true },
  })

  return Response.json(entries)
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })
  if (!user) return Response.json({ error: "User not found" }, { status: 404 })

  const { weightKg, recordedAt } = await request.json()
  if (!weightKg || isNaN(Number(weightKg))) {
    return Response.json({ error: "Invalid weight" }, { status: 400 })
  }

  const entry = await prisma.weightEntry.create({
    data: {
      userId: user.id,
      weightKg: Number(weightKg),
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
    },
    select: { id: true, weightKg: true, recordedAt: true },
  })

  return Response.json(entry)
}

export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })
  if (!user) return Response.json({ error: "User not found" }, { status: 404 })

  const { id } = await request.json()
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 })

  const entry = await prisma.weightEntry.findFirst({ where: { id, userId: user.id } })
  if (!entry) return Response.json({ error: "Not found" }, { status: 404 })

  await prisma.weightEntry.delete({ where: { id } })
  return Response.json({ ok: true })
}
