import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./app/_lib/supabase/middleware-session";

// Rate-limit de signup por IP (SPEC 14).
// Estado en memoria del proceso: efímero, por instancia (ver Risks del spec).
const SIGNUP_WINDOW_MS = 10 * 60 * 1000; // 10 min
const SIGNUP_MAX_HITS = 5; // 5 signups por ventana
const signupHits = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function signupRateLimited(request: NextRequest): boolean {
  const ip = clientIp(request);
  const now = Date.now();
  const entry = signupHits.get(ip);

  if (!entry || now > entry.resetAt) {
    signupHits.set(ip, { count: 1, resetAt: now + SIGNUP_WINDOW_MS });
    return false;
  }
  if (entry.count >= SIGNUP_MAX_HITS) {
    return true;
  }
  entry.count += 1;
  return false;
}

export async function proxy(request: NextRequest) {
  if (request.method === "POST" && request.nextUrl.pathname === "/api/signup") {
    if (signupRateLimited(request)) {
      return NextResponse.json(
        { ok: false, error: "Demasiados intentos. Inténtalo más tarde." },
        { status: 429 }
      );
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - image/asset files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
