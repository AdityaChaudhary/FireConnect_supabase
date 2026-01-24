import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'

export function createSupabaseServerClient(request: Request) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const responseHeaders = new Headers()

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookies = parseCookieHeader(request.headers.get('Cookie') ?? '')
        return cookies.map(c => ({ name: c.name, value: c.value ?? '' }))
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          responseHeaders.append('Set-Cookie', serializeCookieHeader(name, value, { ...options, path: '/' }))
        )
      },
    },
  })

  return { supabase, responseHeaders }
}
