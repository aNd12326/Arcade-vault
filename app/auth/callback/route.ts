import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../_lib/supabase/server";

/**
 * OAuth + email-confirmation callback. Exchanges the `code` for a session
 * (cookies written via the server client) and redirects to `next` or `/`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only same-origin relative paths are allowed, to avoid open redirects via
  // tampered confirmation/OAuth links (e.g. `//evil.com`, `https://evil.com`).
  const raw = searchParams.get("next") ?? "/";
  const next =
    raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
      ? raw
      : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=auth_callback`);
}
