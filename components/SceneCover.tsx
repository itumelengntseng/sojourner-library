import type { CSSProperties } from "react";
import { seedOf, type Work } from "@/lib/catalogue";

// A living cover: two layered scenes — a Harlem street at lamp-lighting, then the
// open Free State plains — dissolving into one another with gentle parallax.
// Pure CSS animation; it holds still for readers who prefer reduced motion.

function HarlemStreet({ id }: { id: string }) {
  const windows = [];
  for (let b = 0; b < 4; b++) {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 2; c++) {
        const lit = (b * 7 + r * 3 + c) % 3 !== 0;
        windows.push(
          <rect key={`${b}-${r}-${c}`} x={8 + b * 50 + c * 18} y={92 + r * 26} width="10" height="14" rx="1"
            fill={lit ? "var(--color-lamplight)" : "#1a1512"} opacity={lit ? 0.9 : 1} />,
        );
      }
    }
  }
  return (
    <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id={`dusk-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1830" />
          <stop offset="0.55" stopColor="#5a2d2a" />
          <stop offset="1" stopColor="#d9822b" />
        </linearGradient>
        <radialGradient id={`lampglow-${id}`}>
          <stop offset="0" stopColor="#f2c57c" stopOpacity="0.8" />
          <stop offset="1" stopColor="#f2c57c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="300" fill={`url(#dusk-${id})`} />
      <g className="cover-far">
        <path d="M0 120 h30 v-30 h25 v40 h30 v-55 h20 v45 h35 v-25 h30 v35 h30 V300 H0Z" fill="#2a1f22" opacity="0.7" />
      </g>
      <g className="cover-near">
        {[0, 1, 2, 3].map((b) => (
          <g key={b}>
            <rect x={b * 50} y={70 + (b % 2) * 6} width="48" height="230" fill={b % 2 ? "#5b3626" : "#6b4428"} />
            <rect x={b * 50} y={66 + (b % 2) * 6} width="48" height="6" fill="#3f2615" />
            <path d={`M${b * 50 + 4} ${150} h40 M${b * 50 + 4} ${176} h40`} stroke="#1d1a17" strokeWidth="1.2" />
          </g>
        ))}
        {windows}
        <rect x="0" y="236" width="200" height="64" fill="#2b2724" />
        <rect x="0" y="236" width="200" height="4" fill="#4a423b" />
      </g>
      <g className="cover-lamp">
        <circle cx="160" cy="196" r="34" fill={`url(#lampglow-${id})`} />
        <rect x="158" y="196" width="3" height="44" fill="#1d1a17" />
        <rect x="153" y="190" width="13" height="8" rx="2" fill="#f2c57c" />
      </g>
    </svg>
  );
}

function FreeStatePlains({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id={`highveld-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fa6c9" />
          <stop offset="0.6" stopColor="#f0d9a8" />
          <stop offset="1" stopColor="#e9b46a" />
        </linearGradient>
      </defs>
      <rect width="200" height="300" fill={`url(#highveld-${id})`} />
      <circle cx="150" cy="150" r="16" fill="#fff3d6" opacity="0.85" />
      <g className="cover-far">
        {/* Flat-topped sandstone koppies on the horizon */}
        <path d="M-10 196 L20 196 L32 168 L70 168 L84 196 L120 196 L128 180 L156 180 L166 196 L210 196 V300 H-10Z" fill="#b5651d" opacity="0.75" />
      </g>
      <g className="cover-near">
        <path d="M-10 206 Q100 196 210 208 V300 H-10Z" fill="#c9a77c" />
        <path d="M-10 236 Q100 226 210 240 V300 H-10Z" fill="#a8824f" />
        {Array.from({ length: 24 }, (_, i) => (
          <path key={i} d={`M${i * 9 - 4} ${258 + (i % 3) * 6} q2 -10 4 0`} stroke="#6b4428" strokeWidth="1" fill="none" />
        ))}
      </g>
    </svg>
  );
}

export function SceneCover({ work, size = "md" }: { work: Work; size?: "md" | "lg" }) {
  const hue = seedOf(work.slug);
  const style = { "--cover-hue": `${hue}deg`, "--cover-delay": `${-(hue % 18)}s` } as CSSProperties;
  return (
    <figure
      role="img"
      aria-label={`Cover of ${work.title} by ${work.author}`}
      style={style}
      className={`scene-cover relative isolate overflow-hidden rounded-sm border border-timber-dark shadow-[0_20px_40px_-14px_rgb(0_0_0/0.8)] ${
        size === "lg" ? "w-full max-w-xs" : "w-full"
      } aspect-[2/3]`}
    >
      <div className="scene scene-harlem absolute inset-0" aria-hidden="true"><HarlemStreet id={work.slug} /></div>
      <div className="scene scene-plains absolute inset-0" aria-hidden="true"><FreeStatePlains id={work.slug} /></div>
      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" aria-hidden="true" />
      <figcaption className="absolute inset-x-0 bottom-0 p-3 text-left">
        <span className="block text-base leading-tight text-paper sm:text-lg">{work.title}</span>
        <span className="mt-1 block font-sans text-[0.7rem] uppercase tracking-[0.2em] text-lamplight">{work.author}</span>
        {work.isPlaceholder && (
          <span className="mt-2 inline-block rounded-sm border border-sandstone/50 px-1.5 py-0.5 font-sans text-[0.6rem] uppercase tracking-wider text-sandstone">
            Placeholder
          </span>
        )}
      </figcaption>
    </figure>
  );
}
