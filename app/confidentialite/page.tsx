// TODO: Update APP_NAME and contact email
const APP_NAME = "RepAI"
const CONTACT_EMAIL = "support@example.com"

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-10 py-5 flex items-center justify-between">
        <a href="/" className="text-lg font-extrabold tracking-tight text-gray-900">{APP_NAME}</a>
        <a href="/" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">← Back</a>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs font-bold text-violet-600 uppercase tracking-widest mb-4">Legal</p>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 font-medium mb-12">Last updated: March 2026</p>

        <div className="flex flex-col gap-10 text-gray-700">

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">1. Who are we?</h2>
            <p className="text-sm font-medium leading-relaxed">
              {APP_NAME} is a SaaS platform. We collect and process personal data in the context of providing our services. For any questions about your data, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-600 hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">2. Data collected</h2>
            <p className="text-sm font-medium leading-relaxed mb-3">We collect the following data:</p>
            <ul className="flex flex-col gap-2 text-sm font-medium">
              {[
                "Email address and password (when creating an account)",
                "Billing information (processed by Stripe — we do not have access to your bank details)",
                "Data entered in the platform (items, generations)",
                "Connection and usage data (logs, IP address)",
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 mt-1.5" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">3. Use of data</h2>
            <p className="text-sm font-medium leading-relaxed mb-3">Your data is used to:</p>
            <ul className="flex flex-col gap-2 text-sm font-medium">
              {[
                "Provide and improve our services",
                "Manage your account and subscription",
                "Send service-related communications (updates, billing)",
                "Generate content via AI (data is transmitted to Groq securely)",
                "Ensure security and prevent abuse",
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 mt-1.5" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">4. Data sharing</h2>
            <p className="text-sm font-medium leading-relaxed">
              We never sell your data. We use trusted processors: <strong>Supabase</strong> (hosting and authentication), <strong>Stripe</strong> (payment), <strong>Groq</strong> (AI generation), <strong>Resend</strong> (emails). Each is subject to strict confidentiality obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">5. Data retention</h2>
            <p className="text-sm font-medium leading-relaxed">
              Your data is retained for the duration of your subscription, then deleted within 30 days of account cancellation, unless required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">6. Your rights</h2>
            <p className="text-sm font-medium leading-relaxed mb-3">You have the following rights regarding your data:</p>
            <ul className="flex flex-col gap-2 text-sm font-medium">
              {[
                "Right to access your personal data",
                "Right to rectification of inaccurate data",
                "Right to erasure (right to be forgotten)",
                "Right to data portability",
                "Right to object to processing",
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 mt-1.5" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-sm font-medium leading-relaxed mt-3">
              To exercise these rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-600 hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">7. Cookies</h2>
            <p className="text-sm font-medium leading-relaxed">
              We only use cookies strictly necessary for the operation of the service (authentication session). No advertising or third-party tracking cookies are used.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">8. Updates</h2>
            <p className="text-sm font-medium leading-relaxed">
              We may update this policy at any time. In case of material changes, you will be notified by email. The last updated date is shown at the top of this page.
            </p>
          </section>

        </div>
      </div>

      <footer className="border-t border-gray-100 px-10 py-6 flex items-center justify-between mt-8">
        <span className="font-extrabold text-gray-900">{APP_NAME}</span>
        <div className="flex gap-6 text-sm font-semibold text-gray-400">
          <a href="/confidentialite" className="text-violet-600">Privacy</a>
          <a href="/conditions" className="hover:text-gray-900 transition-colors">Terms</a>
          <a href="/support" className="hover:text-gray-900 transition-colors">Contact</a>
        </div>
      </footer>
    </div>
  )
}
