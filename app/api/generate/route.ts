import Groq from "groq-sdk"
import { createRateLimiter } from "@/lib/rate-limit"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const rateLimit = createRateLimiter({ maxRequests: 10, windowMs: 60_000 })

// TODO: Customize generation types and prompts for your use case
export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

  const authUser = await getAuthUser(request)
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { item, mode, tone = "professional", length = "standard", instructions = "" } = await request.json()

  // Input length limits — prevent token exhaustion and prompt injection
  if (!item?.name || typeof item.name !== "string") {
    return Response.json({ error: "item.name requis" }, { status: 400 })
  }
  if (item.name.length        > 200)   return Response.json({ error: "item.name trop long (max 200)"        }, { status: 400 })
  if ((item.description ?? "").length > 2_000) return Response.json({ error: "item.description trop long (max 2 000)" }, { status: 400 })
  if (instructions.length     > 1_000) return Response.json({ error: "instructions trop longues (max 1 000)" }, { status: 400 })

  const email = authUser.email

  const itemDetails = [
    `Name: ${item.name}`,
    item.description ? `Description: ${item.description}` : null,
    item.status ? `Status: ${item.status}` : null,
  ].filter(Boolean).join("\n")

  const toneMap: Record<string, string> = {
    professional: "Use a professional and polished tone.",
    casual: "Use a casual, conversational tone.",
    formal: "Use a formal and authoritative tone.",
    friendly: "Use a warm, friendly and approachable tone.",
  }

  const lengthMap: Record<string, string> = {
    short: "LENGTH CONSTRAINT: Very short, 50 to 100 words maximum. Be concise.",
    standard: "",
    long: "LENGTH CONSTRAINT: Detailed, 250 to 350 words. Expand on each point.",
  }

  const toneInstruction = toneMap[tone] ?? toneMap.professional
  const lengthInstruction = length !== "standard" ? lengthMap[length] : ""
  const customInstruction = instructions ? `Additional instructions: ${instructions}` : ""

  let systemPrompt: string
  let userPrompt: string

  if (mode === "text") {
    systemPrompt = `You are an expert content writer. You create clear, compelling, and well-structured text content.`
    userPrompt = `Write a detailed text description for the following item:

${itemDetails}

${toneInstruction} ${lengthInstruction}
${customInstruction}

Write the final content directly, without placeholders or brackets.`

  } else if (mode === "email") {
    systemPrompt = `You are an expert email copywriter. You write engaging, personalized emails that get responses.`
    userPrompt = `Write a professional email about the following item:

${itemDetails}

Guidelines:
- Start with a subject line (format "Subject: ...")
- Begin with "Hello,"
- Present the item in 2-3 compelling sentences
- Include a clear call to action
- End with "Best regards," [Your name]

${toneInstruction} ${lengthInstruction}
${customInstruction}`

  } else if (mode === "summary") {
    systemPrompt = `You are an expert at writing concise, informative summaries that capture the key points.`
    userPrompt = `Write a clear and concise summary for the following item:

${itemDetails}

Guidelines:
- Capture the most important information
- Use bullet points if helpful
- Be accurate and factual

${toneInstruction} ${lengthInstruction}
${customInstruction}`

  } else if (mode === "social") {
    systemPrompt = `You are an expert social media copywriter. You create engaging posts that drive interaction and shares.`
    userPrompt = `Write a social media post about the following item:

${itemDetails}

Guidelines:
- Start with an attention-grabbing hook
- Keep it engaging and shareable
- Include relevant hashtags at the end
- Include a call to action

${toneInstruction} ${lengthInstruction}
${customInstruction}

Write the final post directly, ready to publish.`

  } else {
    return Response.json({ error: "Invalid mode" }, { status: 400 })
  }

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.72,
    max_tokens: 1200,
  })

  const content = completion.choices[0].message.content ?? ""

  return Response.json({ content })
}
