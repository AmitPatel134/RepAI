import { Resend } from "resend"

const SUPPORT_FROM = "RepAI Support <support@repai.fr>"
const SUPPORT_TO = "support@repai.fr"
const APP_NAME = "RepAI"

export async function POST(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { name, email, subject, message } = await request.json()

  const { data, error } = await resend.emails.send({
    from: SUPPORT_FROM,
    to: SUPPORT_TO,
    replyTo: email,
    subject: `[Support ${APP_NAME}] ${subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">New support message</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 80px;">Name</td><td style="padding: 8px 0; font-weight: 600;">${name}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Email</td><td style="padding: 8px 0; font-weight: 600;">${email}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Subject</td><td style="padding: 8px 0; font-weight: 600;">${subject}</td></tr>
        </table>
        <div style="background: #f9fafb; border-radius: 12px; padding: 16px; font-size: 14px; color: #111827; line-height: 1.6;">
          ${message.replace(/\n/g, "<br>")}
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">Reply directly to this email to contact ${name}.</p>
      </div>
    `,
  })

  if (error) {
    console.error("[support] Resend error:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  console.log("[support] Email sent:", data?.id)
  return Response.json({ ok: true })
}
