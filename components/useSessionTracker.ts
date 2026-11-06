"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { countWords } from "@/lib/engine/readingTime";
import type { Paragraph } from "@/lib/reader";
import { ACTIVITY_THROTTLE_MS, MAX_ACTIVITY } from "@/lib/sessions";

const HEARTBEAT_MS = 60_000;

/**
 * Watches the reader read: notes activity (scrolls, keys, taps, page turns) and the
 * furthest paragraph seen, and reports the session to /api/sessions as it goes.
 * Returns how many words of the chapter lie behind the reader.
 */
export function useSessionTracker(opts: {
  slug: string;
  position: number;
  paras: Paragraph[];
  textRef: RefObject<HTMLDivElement | null>;
  /** false = proof copy: measure progress but never report a session. */
  record?: boolean;
}): number {
  const { slug, position, paras, textRef, record = true } = opts;
  const [behind, setBehind] = useState(0);
  const state = useRef({ id: "", startedAt: 0, activity: [] as number[], startWords: -1, furthest: 0, dirty: false });

  useEffect(() => {
    const s = state.current;
    s.id = crypto.randomUUID();
    s.startedAt = Date.now();
    s.activity = [s.startedAt];
    s.startWords = -1;
    s.furthest = 0;
    s.dirty = false;

    /** Words in paragraphs the reader has moved past (or the whole chapter once its end is on screen). */
    const wordsPassed = () => {
      const box = textRef.current;
      if (!box) return { passed: 0, firstVisible: 0 };
      const view = box.getBoundingClientRect();
      let passed = 0;
      let firstVisible = -1;
      const els = Array.from(box.querySelectorAll<HTMLElement>("[data-para]"));
      els.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const p = paras[Number(el.dataset.para)];
        if (!p) return;
        const gone = r.bottom <= 0 || r.right <= view.left;
        const endInView = i === els.length - 1 && r.bottom <= window.innerHeight && r.right <= view.right && r.bottom > 0;
        if (gone || endInView) passed = Math.max(passed, p.wordsBefore + countWords(p.text));
        else if (firstVisible < 0) firstVisible = p.wordsBefore;
      });
      return { passed, firstVisible: Math.max(0, firstVisible) };
    };

    const measure = () => {
      const { passed, firstVisible } = wordsPassed();
      if (s.startWords < 0) s.startWords = firstVisible;
      if (passed > s.furthest) { s.furthest = passed; setBehind(passed); }
    };

    const send = (final: boolean) => {
      if (!s.dirty && !final) return;
      s.dirty = false;
      const body = JSON.stringify({
        sessionId: s.id, slug, position, startedAt: s.startedAt,
        activity: s.activity.slice(-MAX_ACTIVITY), wordsRead: Math.max(0, s.furthest - Math.max(0, s.startWords)),
      });
      if (!record) return;
      if (final && navigator.sendBeacon) navigator.sendBeacon("/api/sessions", new Blob([body], { type: "application/json" }));
      else fetch("/api/sessions", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    };

    const onActivity = () => {
      const now = Date.now();
      const last = s.activity[s.activity.length - 1] ?? 0;
      if (now - last >= ACTIVITY_THROTTLE_MS) { s.activity.push(now); s.dirty = true; }
      measure();
    };
    const onHide = () => { if (document.visibilityState === "hidden") send(true); };

    // Starting point: what's on screen when the room opens (after any bookmark jump).
    const first = window.setTimeout(measure, 300);
    const box = textRef.current;
    const events = ["scroll", "keydown", "pointerdown", "wheel", "touchmove"] as const;
    for (const e of events) window.addEventListener(e, onActivity, { passive: true });
    box?.addEventListener("scroll", onActivity, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    const beat = window.setInterval(() => send(false), HEARTBEAT_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(beat);
      for (const e of events) window.removeEventListener(e, onActivity);
      box?.removeEventListener("scroll", onActivity);
      document.removeEventListener("visibilitychange", onHide);
      send(true);
    };
  }, [slug, position, paras, textRef, record]);

  return behind;
}
