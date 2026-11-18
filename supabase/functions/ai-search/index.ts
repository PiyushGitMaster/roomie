import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@4'

const filtersSchema = z.object({
  city: z.string().max(120).nullable().optional(),
  areas: z.array(z.string().max(100)).max(10).nullable().optional(),
  budget_max: z.number().int().min(0).max(1_000_000).nullable().optional(),
  smoking: z.string().max(50).nullable().optional(),
  work: z.string().max(50).nullable().optional(),
  cleanliness: z.string().max(50).nullable().optional(),
}).strict()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' })
  const authorization = request.headers.get('Authorization')
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!projectUrl || !anonKey || !serviceKey || !anthropicKey) {
    console.error('AI search is missing required server environment values.')
    return response(503, { error: 'AI search is not configured.' })
  }
  if (!authorization?.startsWith('Bearer ')) return response(401, { error: 'Sign in to use AI search.' })

  const authClient = createClient(projectUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return response(401, { error: 'Sign in to use AI search.' })

  let input: unknown
  try { input = await request.json() } catch { return response(400, { error: 'Request must be JSON.' }) }
  if (!input || typeof input !== 'object' || !('query' in input) || typeof input.query !== 'string') {
    return response(400, { error: 'A search query is required.' })
  }
  const query = input.query.trim()
  if (query.length < 2 || query.length > 500) return response(400, { error: 'Search must be between 2 and 500 characters.' })

  const service = createClient(projectUrl, serviceKey)
  const { count, error: countError } = await service.from('ai_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
  if (countError) {
    console.error('AI request rate check failed:', countError.message)
    return response(503, { error: 'Could not verify search rate limit.' })
  }
  if ((count ?? 0) >= 10) return response(429, { error: 'You have reached the hourly AI search limit.' })
  const { error: insertError } = await service.from('ai_requests').insert({ user_id: user.id })
  if (insertError) {
    console.error('Could not record AI request:', insertError.message)
    return response(503, { error: 'Could not start AI search.' })
  }

  const prompt = `Extract only explicitly stated flatmate filters from the user search. Return one strict JSON object with optional keys city (string), areas (array of strings), budget_max (integer in rupees), smoking (string), work (string), cleanliness (string). Use null for unknowns and do not infer profile facts. Do not return prose. Search: ${JSON.stringify(query)}`
  const anthropic = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!anthropic.ok) {
    console.error('Anthropic search request failed:', anthropic.status)
    return response(502, { error: 'AI search is temporarily unavailable.' })
  }
  const result = await anthropic.json()
  const content = result?.content?.find((part: { type?: string }) => part.type === 'text')?.text
  if (typeof content !== 'string') return response(502, { error: 'AI returned no filter results.' })
  let candidate: unknown
  try { candidate = JSON.parse(content) } catch {
    return response(502, { error: 'AI returned invalid filters.' })
  }
  const parsed = filtersSchema.safeParse(candidate)
  if (!parsed.success) {
    return response(502, { error: 'AI returned invalid filters.' })
  }
  const filters: Record<string, unknown> = {}
  if (typeof parsed.data.city === 'string') filters.city = parsed.data.city
  if (Array.isArray(parsed.data.areas)) filters.areas = parsed.data.areas
  if (typeof parsed.data.budget_max === 'number') filters.budget_max = parsed.data.budget_max
  for (const key of ['smoking', 'work', 'cleanliness']) {
    const value = parsed.data[key as keyof typeof parsed.data]
    if (typeof value === 'string') filters[key] = value
  }
  return response(200, { filters })
})
