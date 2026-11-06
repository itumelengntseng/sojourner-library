// Harlem timeline and places. PLACEHOLDER ONLY — Itu will supply the real places and events.
// Places: give a cross street (110–155) and an avenue id from lib/timeline.ts, or "elsewhere"
// for somewhere off the Harlem map. Events: a date like 1924, 1924-03 or 1924-03-15,
// optionally approximate, the place id, and the works it belongs to. `npm test` checks this file.
import type { Timeline } from "@/lib/timeline";

export const TIMELINE: Timeline = {
  isPlaceholder: true,
  places: [
    { id: "placeholder-place-a", name: "Placeholder Place A", isPlaceholder: true, street: 125, avenue: "adam-clayton-powell" },
    { id: "placeholder-place-b", name: "Placeholder Place B", isPlaceholder: true, street: 135, avenue: "malcolm-x" },
    { id: "placeholder-place-c", name: "Placeholder Place C", isPlaceholder: true, street: 116, avenue: "frederick-douglass" },
    { id: "placeholder-place-d", name: "Placeholder Place D", isPlaceholder: true, elsewhere: "Off this map" },
  ],
  events: [
    { id: "placeholder-event-1", title: "Placeholder Event 1", isPlaceholder: true, date: "1900", approximate: true, placeId: "placeholder-place-d", appearsIn: ["placeholder-work-one"] },
    { id: "placeholder-event-2", title: "Placeholder Event 2", isPlaceholder: true, date: "1910-06", placeId: "placeholder-place-a", appearsIn: ["placeholder-work-one"] },
    { id: "placeholder-event-3", title: "Placeholder Event 3", isPlaceholder: true, date: "1920-03-14", placeId: "placeholder-place-b", appearsIn: ["placeholder-work-two"] },
    { id: "placeholder-event-4", title: "Placeholder Event 4", isPlaceholder: true, date: "1930", placeId: "placeholder-place-c", appearsIn: ["placeholder-work-three"] },
    { id: "placeholder-event-5", title: "Placeholder Event 5", isPlaceholder: true, date: "1940-11", placeId: "placeholder-place-a", appearsIn: ["placeholder-work-two"] },
  ],
};
