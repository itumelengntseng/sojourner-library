"use server";

import { revalidatePath } from "next/cache";
import { getWork } from "@/lib/catalogue";
import { isLoanPeriod } from "@/lib/loanDesk";
import { runDesk } from "@/lib/loanStore";

export interface DeskState {
  ok: boolean;
  message: string;
}

export async function deskAction(_: DeskState, form: FormData): Promise<DeskState> {
  const slug = String(form.get("slug") ?? "");
  if (!getWork(slug)) return { ok: false, message: "That work isn't in the catalogue." };
  const intent = String(form.get("intent") ?? "");
  const loanId = String(form.get("loanId") ?? "");
  let result: DeskState;
  if (intent === "borrow") {
    const period = form.get("period");
    if (!isLoanPeriod(period)) return { ok: false, message: "Choose how long you'd like it for." };
    result = await runDesk(slug, { kind: "borrow", period });
  } else if (intent === "renew" && loanId) {
    result = await runDesk(slug, { kind: "renew", loanId });
  } else if (intent === "return" && loanId) {
    result = await runDesk(slug, { kind: "return", loanId });
  } else {
    return { ok: false, message: "The desk didn't understand that request." };
  }
  revalidatePath(`/works/${slug}`);
  return result;
}
