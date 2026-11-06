import "server-only";
import { cookies } from "next/headers";
import { CANON_COOKIE, resolveCanonView } from "./canon";

export async function canonView(param: string | string[] | undefined) {
  return resolveCanonView(param, (await cookies()).get(CANON_COOKIE)?.value);
}
