import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = process.env.STRAVA_CLIENT_ID
  if (!clientId) return Response.json({ error: "Strava not configured" }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://repai.fr"
  const redirectUri = `${appUrl}/api/strava/callback`
  const state = Buffer.from(authUser.email).toString("base64")

  const url = new URL("https://www.strava.com/oauth/authorize")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("approval_prompt", "auto")
  url.searchParams.set("scope", "activity:read_all")
  url.searchParams.set("state", state)

  return Response.redirect(url.toString())
}
