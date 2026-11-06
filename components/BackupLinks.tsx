import type { ShelvedWork } from "@/lib/manuscript";

/** C27: download a work as Markdown (the import's own shape) — and its set-aside chapters, if any. */
export function BackupLinks({ slug, title, shelf }: { slug: string; title: string; shelf?: ShelvedWork }) {
  const href = `/writers-room/export/${encodeURIComponent(slug)}`;
  const setAside = shelf?.chapters.filter((c) => c.archived).length ?? 0;
  const cls = "font-sans text-xs text-lamplight underline underline-offset-2";
  return (
    <span className="inline-flex flex-wrap gap-x-3">
      <a href={href} download className={cls}>Download Markdown<span className="sr-only">: {title}</span></a>
      {setAside > 0 && (
        <a href={`${href}?part=set-aside`} download className={cls}>
          {setAside} set-aside chapter{setAside === 1 ? "" : "s"}<span className="sr-only"> of {title}, as Markdown</span>
        </a>
      )}
    </span>
  );
}
