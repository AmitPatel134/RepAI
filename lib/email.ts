import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "RepAI"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com"
const FROM_EMAIL = process.env.FROM_EMAIL ?? `noreply@example.com`
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? `support@example.com`

export async function sendWelcomeEmail({ to, name }: { to: string; name?: string }) {
  const displayName = name ? name : "there"
  await resend.emails.send({
    from: `${APP_NAME} <${FROM_EMAIL}>`,
    to,
    subject: `Welcome to ${APP_NAME}!`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">

        <!-- HEADER -->
        <div style="background:#7c3aed;padding:40px 32px 32px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#ddd6fe;letter-spacing:.1em;text-transform:uppercase;">${APP_NAME}</p>
          <h1 style="margin:0;font-size:28px;font-weight:900;color:#fff;line-height:1.2;">
            Welcome to ${APP_NAME}, ${displayName}!
          </h1>
          <p style="margin:12px 0 0;font-size:15px;color:#ede9fe;font-weight:500;line-height:1.5;">
            Your account is ready. Start exploring everything ${APP_NAME} has to offer.
          </p>
        </div>

        <!-- BODY -->
        <div style="padding:36px 32px;">

          <p style="margin:0 0 24px;font-size:15px;color:#374151;font-weight:500;line-height:1.6;">
            Here's what you can do right away:
          </p>

          <!-- FEATURE CARDS -->
          <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
            <tr>
              <td style="padding:16px;background:#f5f3ff;border:1px solid #ede9fe;border-radius:12px;vertical-align:top;width:33%;">
                <p style="margin:0 0 6px;font-size:20px;">📦</p>
                <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#7c3aed;">Manage Items</p>
                <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">Create, organize, and track your items in one place.</p>
              </td>
              <td style="width:12px;"></td>
              <td style="padding:16px;background:#f5f3ff;border:1px solid #ede9fe;border-radius:12px;vertical-align:top;width:33%;">
                <p style="margin:0 0 6px;font-size:20px;">✨</p>
                <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#7c3aed;">AI Generation</p>
                <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">Generate content using AI in just a few seconds.</p>
              </td>
              <td style="width:12px;"></td>
              <td style="padding:16px;background:#f5f3ff;border:1px solid #ede9fe;border-radius:12px;vertical-align:top;width:33%;">
                <p style="margin:0 0 6px;font-size:20px;">🚀</p>
                <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#7c3aed;">Get Started</p>
                <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">Dive in — your free plan is already active and ready to use.</p>
              </td>
            </tr>
          </table>

          <!-- CTA -->
          <div style="text-align:center;margin-bottom:28px;">
            <a href="${APP_URL}/app"
              style="display:inline-block;background:#7c3aed;color:#fff;font-weight:800;font-size:15px;padding:16px 40px;border-radius:9999px;text-decoration:none;letter-spacing:.02em;">
              Open my dashboard →
            </a>
          </div>

          <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6;">
            Have a question? Just reply to this email — we're happy to help.
          </p>

        </div>

        <!-- FOOTER -->
        <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
            ${APP_NAME} · <a href="${APP_URL}" style="color:#7c3aed;text-decoration:none;font-weight:600;">${APP_URL.replace("https://", "")}</a>
          </p>
        </div>

      </div>
    `,
  })
}

export async function sendNotificationEmail({
  to,
  subject,
  title,
  body,
  ctaLabel,
  ctaUrl,
}: {
  to: string
  subject: string
  title: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
}) {
  await resend.emails.send({
    from: `${APP_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:#7c3aed;padding:32px 32px 24px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#ddd6fe;letter-spacing:.1em;text-transform:uppercase;">${APP_NAME}</p>
          <h1 style="margin:0;font-size:22px;font-weight:900;color:#fff;">${title}</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 24px;font-size:15px;color:#374151;font-weight:500;line-height:1.6;">${body}</p>
          ${ctaLabel && ctaUrl ? `
          <div style="text-align:center;margin-bottom:28px;">
            <a href="${ctaUrl}"
              style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:14px;padding:14px 32px;border-radius:9999px;text-decoration:none;">
              ${ctaLabel} →
            </a>
          </div>` : ""}
        </div>
        <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
            ${APP_NAME} — You received this email because you have notifications enabled.
          </p>
        </div>
      </div>
    `,
  })
}
