import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/authServer"

// Fields safe to expose to the client — never includes billing or internal IDs
const USER_SELECT = {
  id:        true,
  email:     true,
  name:      true,
  telephone: true,
  company:   true,
  plan:      true,
  createdAt: true,
} as const

export async function GET(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where:  { email: authUser.email },
    select: USER_SELECT,
  })
  return Response.json(user)
}

export async function PATCH(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { name, telephone, company } = await request.json()
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: "name is required" }, { status: 400 })
  }
  if (name.length > 200)      return Response.json({ error: "name trop long (max 200)"      }, { status: 400 })
  if (telephone && typeof telephone === "string" && telephone.length > 50)  return Response.json({ error: "telephone trop long (max 50)"   }, { status: 400 })
  if (company   && typeof company   === "string" && company.length   > 200) return Response.json({ error: "company trop long (max 200)"   }, { status: 400 })

  const user = await prisma.user.update({
    where:  { email: authUser.email },
    data:   { name, telephone, company },
    select: USER_SELECT,
  })
  return Response.json(user)
}

export async function POST(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (body.email && body.email !== authUser.email) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const user = await prisma.user.upsert({
    where:  { email: authUser.email },
    update: {},
    create: {
      email:     authUser.email,
      name:      body.name,
      telephone: body.telephone ?? null,
      company:   body.company  ?? null,
    },
    select: USER_SELECT,
  })
  return Response.json(user)
}
