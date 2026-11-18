import { createClient } from 'npm:@supabase/supabase-js@2'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed.' })
  const authorization = request.headers.get('Authorization')
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceRoleKey) {
    console.error('Account deletion is missing required Supabase server environment values.')
    return respond(503, { error: 'Account deletion is not configured.' })
  }
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'Sign in to delete your account.' })

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user?.email) return respond(401, { error: 'Sign in to delete your account.' })

  let confirmation: unknown
  try { confirmation = (await request.json()).confirm_email } catch { return respond(400, { error: 'Confirm your account email to continue.' }) }
  if (typeof confirmation !== 'string' || confirmation.trim().toLowerCase() !== user.email.toLowerCase()) {
    return respond(400, { error: 'The confirmation email does not match your account.' })
  }

  const admin = createClient(url, serviceRoleKey)
  const { data: files, error: listError } = await admin.storage.from('profile-photos').list(user.id, { limit: 1000 })
  if (listError) {
    console.error('Could not list account profile photos:', listError.message)
    return respond(503, { error: 'Could not safely remove account photos. Please try again later.' })
  }
  const paths = (files ?? []).filter((file) => file.name).map((file) => `${user.id}/${file.name}`)
  if (paths.length) {
    const { error: removeError } = await admin.storage.from('profile-photos').remove(paths)
    if (removeError) {
      console.error('Could not remove account profile photos:', removeError.message)
      return respond(503, { error: 'Could not safely remove account photos. Please try again later.' })
    }
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('Could not delete the authenticated ROOMIE account:', deleteError.message)
    return respond(503, { error: 'Account deletion did not complete. Please contact your service administrator.' })
  }
  return respond(200, { deleted: true })
})
