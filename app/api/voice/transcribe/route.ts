import Groq from "groq-sdk"
import { getAuthUser } from "@/lib/authServer"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await request.formData()
    const audio = formData.get("audio") as File | null
    if (!audio) return Response.json({ error: "Audio required" }, { status: 400 })

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
