import { GoogleGenAI } from "npm:@google/genai";
import { handleOptions, json, readPayload } from '../_shared/http.ts'
import { requireWorkspace } from '../_shared/supabase.ts'

const DEFAULT_MODEL = 'gemini-3.5-flash'

Deno.serve(async (req) => {
  const early = handleOptions(req)
  if (early) return early

  try {
    const { channel = '', args = {} } = await readPayload(req)
    await requireWorkspace(req)

    if (channel !== 'recruiter:generateLlm') {
      return json({ error: `Unsupported recruiter AI channel: ${channel}` }, 400)
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return json({
        text: '',
        error: 'GEMINI_API_KEY is not configured for the recruiter-ai Edge Function.',
      }, 500)
    }

    const model = Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL
    const systemPrompt = String(args.systemPrompt ?? '').trim()
    const prompt = String(args.prompt ?? '').trim()
    const temperature = Number(args.temperature ?? 0.4)

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: Number.isFinite(temperature) ? temperature : 0.4,
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
      },
    })

    const text = response.text ?? ''
    return json({
      text,
      model,
      provider: 'google',
      sdk: '@google/genai',
    })
  } catch (error) {
    console.error('recruiter-ai Gemini error', error)
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      error instanceof Error && error.message === 'Authentication required' ? 401 : 500,
    )
  }
})
