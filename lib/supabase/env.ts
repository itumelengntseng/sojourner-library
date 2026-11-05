// Supabase is optional until Itu creates the project (see docs/STATE.md → NEEDS ITU).
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export function readSupabaseEnv(env: Record<string, string | undefined> = process.env): SupabaseEnv | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey || !/^https:\/\//.test(url)) return null;
  return { url, anonKey };
}
