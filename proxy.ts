import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { CANON_COOKIE, CANON_COOKIE_MAX_AGE, isCanonView } from "@/lib/canon";

function rememberCanon(request: NextRequest, response: NextResponse) {
  const v = request.nextUrl.searchParams.get("canon");
  if (isCanonView(v)) response.cookies.set(CANON_COOKIE, v, { path: "/", sameSite: "lax", maxAge: CANON_COOKIE_MAX_AGE });
  return response;
}

// Keeps the reader's Supabase session fresh on every request.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = readSupabaseEnv();
  if (!env) return rememberCanon(request, response);

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return rememberCanon(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
