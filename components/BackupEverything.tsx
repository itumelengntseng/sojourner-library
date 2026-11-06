"use client";
import { useEffect, useState } from "react";
import { BACKUP_KEY, backupNote, parseLastBackup } from "@/lib/backupNote";

function read(): string | null {
  try { return window.localStorage.getItem(BACKUP_KEY); } catch { return null; }
}
function write(v: string) {
  try { window.localStorage.setItem(BACKUP_KEY, v); } catch { /* private mode: the note just won't stick */ }
}

/** C31's "Back up everything" button with C35's per-browser "last backed up" line. */
export function BackupEverything() {
  const [last, setLast] = useState<number | null | undefined>(undefined); // undefined = not read yet
  useEffect(() => { setLast(parseLastBackup(read(), Date.now())); }, []);
  const note = last === undefined ? null : backupNote(last, Date.now());
  return (
    <div className="mt-4 font-sans text-sm">
      <a href="/writers-room/backup" download
        onClick={() => { const t = Date.now(); write(String(t)); setLast(t); }}
        className="inline-block rounded border border-lamplight/60 px-3 py-1.5 text-lamplight hover:bg-lamplight/10">Back up everything (.zip)</a>
      <span className="ml-2 text-xs text-sandstone">Every manuscript as Markdown, set-aside chapters included, with the halls, pitch kits and the family wall &amp; timeline. Nothing is removed.</span>
      <p role="status" className="mt-1 min-h-4 text-xs text-sandstone">
        {note && <>{note.text}{note.remind && <> <span className="text-ember">{note.remind}</span></>}</>}
      </p>
    </div>
  );
}
