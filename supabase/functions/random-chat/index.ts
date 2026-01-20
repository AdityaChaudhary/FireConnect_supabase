import "jsr:@supabase/functions-js@2.4.2/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('Missing Authorization header')
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, filters } = await req.json()

    if (action === 'join') {
      // Cleanup previous match if any to avoid hanging peers
      const { data: poolEntry } = await supabaseAdmin
        .from('random_chat_pool')
        .select('matched_with')
        .eq('user_id', user.id)
        .maybeSingle()

      if (poolEntry?.matched_with) {
        await supabaseAdmin
          .from('random_chat_pool')
          .update({ status: 'SEARCHING', matched_with: null })
          .eq('user_id', poolEntry.matched_with)
      }

      const { data, error } = await supabaseAdmin.rpc('match_random_user', {
        current_user_id: user.id,
        filters: filters || null
      })
      if (error) throw error
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'ping') {
      const { error } = await supabaseAdmin
        .from('random_chat_pool')
        .update({ last_ping_at: new Date().toISOString() })
        .eq('user_id', user.id)
      
      if (error) throw error
      
      // Also run cleanup while we are at it
      await supabaseAdmin.rpc('cleanup_random_chat_pool')

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'leave') {
      // 1. Find if we were matched
      const { data: poolEntry } = await supabaseAdmin
        .from('random_chat_pool')
        .select('matched_with')
        .eq('user_id', user.id)
        .single()

      if (poolEntry?.matched_with) {
        // Notify the matched user (they will see it via realtime update on the pool table)
        await supabaseAdmin
          .from('random_chat_pool')
          .update({ status: 'SEARCHING', matched_with: null })
          .eq('user_id', poolEntry.matched_with)
      }

      const { error } = await supabaseAdmin
        .from('random_chat_pool')
        .delete()
        .eq('user_id', user.id)

      if (error) throw error
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'skip') {
      // Leave then join
      const { data: poolEntry } = await supabaseAdmin
        .from('random_chat_pool')
        .select('matched_with')
        .eq('user_id', user.id)
        .single()

      if (poolEntry?.matched_with) {
        // Record the skip interaction for 10-min cool-down
        await supabaseAdmin
          .from('random_chat_skips')
          .upsert({ 
            user_id: user.id, 
            skipped_user_id: poolEntry.matched_with,
            created_at: new Date().toISOString()
          }, { onConflict: 'user_id, skipped_user_id' });

        await supabaseAdmin
          .from('random_chat_pool')
          .update({ status: 'SEARCHING', matched_with: null })
          .eq('user_id', poolEntry.matched_with)
      }

      const { data, error } = await supabaseAdmin.rpc('match_random_user', {
        current_user_id: user.id,
        exclude_user_id: poolEntry?.matched_with || null,
        filters: filters || null
      })
      if (error) throw error
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in random-chat function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
