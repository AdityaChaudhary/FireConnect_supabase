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
      return redirect(next, {
        headers: responseHeaders,
      });
    }
  }

  // return the user to an error page with instructions
  return redirect("/auth/auth-code-error");
}
