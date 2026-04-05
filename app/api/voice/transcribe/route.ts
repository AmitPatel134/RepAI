import Groq from "groq-sdk"
import { getAuthUser } from "@/lib/authServer"
import { createRateLimiter } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const rateLimit = createRateLimiter({ maxRequests: 10, windowMs: 60_000 })

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request)
    if (limited) return limited

    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await request.formData()
    const audio = formData.get("audio") as File | null
    if (!audio) return Response.json({ error: "Audio required" }, { status: 400 })

    // Groq Whisper limit is 25 MB — reject early to avoid memory exhaustion
    const MAX_AUDIO_SIZE = 25 * 1024 * 1024
    if (audio.size > MAX_AUDIO_SIZE) {
      return Response.json({ error: "Fichier audio trop volumineux (max 25 Mo)" }, { status: 400 })
    }

    const transcription = await groq.audio.transcriptions.create({
      file: audio,
      model: "whisper-large-v3",
      language: "fr",
      response_format: "json",
    })

    return Response.json({ transcript: transcription.text })
  } catch (e) {
    console.error("Transcription error:", e)
    return Response.json({ error: "Transcription failed" }, { status: 500 })
  }
}
