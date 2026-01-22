import { redirect } from "react-router";
import { createSupabaseServerClient } from "../../lib/supabase.server";
import type { Route } from "./+types/auth.callback";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  if (code) {
    const { supabase, responseHeaders } = createSupabaseServerClient(request);
    
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Deterministically wait for the session cookies to be set in headers
      // This addresses the race condition without arbitrary timeouts
      let retries = 10;
      while (retries > 0 && !responseHeaders.has("Set-Cookie")) {
        await new Promise(resolve => setTimeout(resolve, 50));
        retries--;
      }

      return redirect(next, {
        headers: responseHeaders,
      });
    }
  }

  // return the user to an error page with instructions
  return redirect("/auth/auth-code-error");
}
