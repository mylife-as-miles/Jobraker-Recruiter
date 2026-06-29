import { handleOptions, json, readPayload } from '../_shared/http.ts'
import { requireWorkspace } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const early = handleOptions(req)
  if (early) return early

  try {
    const { channel = '', args = {} } = await readPayload(req)
    await requireWorkspace(req)

    if (channel !== 'recruiter:generateLlm') {
      return json({ error: `Unsupported recruiter AI channel: ${channel}` }, 400)
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return json({ text: '', error: 'OPENAI_API_KEY is not configured for the recruiter-ai Edge Function.' })
    }

    const prompt = `${String(args.systemPrompt ?? '')}\n\n${String(args.prompt ?? '')}`.trim()
    const completion = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini',
        input: prompt,
        temperature: Number(args.temperature ?? 0.4),
      }),
    })
    const data = await completion.json()
    const text = data.output_text ?? data.output?.flatMap((item: Record<string, unknown>) => item.content ?? []).map((item: Record<string, unknown>) => item.text ?? '').join('') ?? ''
    return json({ text, error: completion.ok ? undefined : data.error?.message ?? 'LLM request failed' })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, error instanceof Error && error.message === 'Authentication required' ? 401 : 500)
  }
})
