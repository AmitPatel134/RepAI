export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { prisma } from "@/lib/prisma"

export async function PATCH(request: Request) {
  try {
    const body = await request.json()

    const user = await prisma.user.update({
      where: { email: body.email },
      data: { plan: body.plan }
    })

    return Response.json(user)
  } catch {
    return Response.json({ error: "Error" }, { status: 500 })
  }
}
