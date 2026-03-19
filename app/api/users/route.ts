import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"

export async function GET(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: authUser.email } })
  return Response.json(user)
}

export async function PATCH(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { name, telephone, company } = await request.json()
  if (!name) return Response.json({ error: "name is required" }, { status: 400 })

  const user = await prisma.user.update({ where: { email: authUser.email }, data: { name, telephone, company } })
  return Response.json(user)
}

export async function POST(request: Request) {
  const body = await request.json()
  const user = await prisma.user.upsert({
    where: { email: body.email },
    update: {},
    create: {
      email: body.email,
      name: body.name,
      telephone: body.telephone ?? null,
      company: body.company ?? null,
    },
  })
  return Response.json(user)
}
