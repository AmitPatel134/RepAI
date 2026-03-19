import { Resend } from "resend"
import { getAuthUser } from "@/lib/authServer"
import { createRateLimiter } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

const SUPPORT_FROM = "RepAI Support <support@repai.fr>"
const SUPPORT_TO = "support@repai.fr"
const APP_NAME = "RepAI"

const rateLimit = createRateLimiter({ maxRequests: 3, windowMs: 60_000 })

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const body = await request.json()
  const { name, subject, message } = body

  if (!name?.trim() || !subject?.trim() || !message?.trim()) {
    return Response.json({ error: "name, subject and message are required" }, { status: 400 })
  }

  if (name.length > 100 || subject.length > 200 || message.length > 5000) {
    return Response.json({ error: "Input too long" }, { status: 400 })
  }

  const safeName = escapeHtml(name.trim())
  const safeEmail = escapeHtml(authUser.email)
  const safeSubject = escapeHtml(subject.trim())
  const safeMessage = escapeHtml(message.trim()).replace(/\n/g, "<br>")

  const { data, error } = await resend.emails.send({
    from: SUPPORT_FROM,
    to: SUPPORT_TO,
    replyTo: authUser.email,
    subject: `[Support ${APP_NAME}] ${safeSubject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">New support message</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 80px;">Name</td><td style="padding: 8px 0; font-weight: 600;">${safeName}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Email</td><td style="padding: 8px 0; font-weight: 600;">${safeEmail}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Subject</td><td style="padding: 8px 0; font-weight: 600;">${safeSubject}</td></tr>
        </table>
        <div style="background: #f9fafb; border-radius: 12px; padding: 16px; font-size: 14px; color: #111827; line-height: 1.6;">
          ${safeMessage}
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">Reply directly to this email to contact ${safeName}.</p>
      </div>
    `,
  })

  if (error) {
    return Response.json({ error: "Failed to send email" }, { status: 500 })
  }

  return Response.json({ ok: true, id: data?.id })
}
