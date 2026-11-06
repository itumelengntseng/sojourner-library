// Spins up an in-memory Postgres (PGlite) that imitates the parts of Supabase
// our migrations rely on: the anon/authenticated roles, auth.users and auth.uid().
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Real Supabase grants every new public table, sequence and function to anon and
  -- authenticated by default. Mirror that so the security audit sees what production sees.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

export async function freshDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(process.cwd(), "supabase/migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  return db;
}

export type Db = Awaited<ReturnType<typeof freshDb>>;

/** Run queries as a signed-in Supabase user (or anon when id is null), with RLS enforced. */
export async function asUser<T>(db: Db, id: string | null, fn: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('role', $1, true)`, [id ? "authenticated" : "anon"]);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [id ?? ""]);
    return fn(tx as unknown as Db);
  });
}

export async function addUser(db: Db, id: string, role: "owner" | "guest", name = "") {
  await db.query(`insert into auth.users (id) values ($1)`, [id]);
  await db.query(`insert into public.readers (id, role, display_name) values ($1, $2, $3)`, [id, role, name]);
}

/** Try one statement as a user; returns the error message, or null if it succeeded. */
export async function attempt(db: Db, id: string | null, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await asUser(db, id, (tx) => tx.query(sql, params));
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
