// Lineage Explorer: the family wall. Pure graph helpers over a lineage file that Itu
// supplies (content/lineage.ts). Nothing here knows any real names or relations.

export interface Person {
  id: string;
  name: string;
  isPlaceholder: boolean;
  note?: string;
  parents: string[];
  partners: string[];
  appearsIn: string[]; // work slugs
}

export interface Lineage {
  title: string;
  isPlaceholder: boolean;
  people: Person[];
}

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Problems a lineage file can have, in words Itu can act on. */
export function validateLineage(l: Lineage, knownWorks: string[] = []): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const p of l.people) {
    if (!ID.test(p.id)) errors.push(`"${p.id}" is not a valid id (use lower-case words joined by hyphens).`);
    if (ids.has(p.id)) errors.push(`"${p.id}" appears twice.`);
    ids.add(p.id);
  }
  for (const p of l.people) {
    if (p.parents.length > 2) errors.push(`${p.name} has more than two parents listed.`);
    for (const r of [...p.parents, ...p.partners]) {
      if (r === p.id) errors.push(`${p.name} is listed as their own relative.`);
      else if (!ids.has(r)) errors.push(`${p.name} refers to "${r}", who isn't in the lineage.`);
    }
    for (const w of p.appearsIn) if (knownWorks.length && !knownWorks.includes(w)) errors.push(`${p.name} appears in "${w}", which isn't in the catalogue.`);
  }
  if (errors.length === 0 && hasAncestryCycle(l.people)) errors.push("Someone is listed as their own ancestor.");
  return errors;
}

function hasAncestryCycle(people: Person[]): boolean {
  const byId = new Map(people.map((p) => [p.id, p]));
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const parent of byId.get(id)?.parents ?? []) if (visit(parent)) return true;
    state.set(id, 2);
    return false;
  };
  return people.some((p) => visit(p.id));
}

/** Rows of the wall: eldest generation first. Partners share the deeper of their rows. */
export function generations(people: Person[]): Person[][] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const depth = new Map<string, number>();
  const depthOf = (id: string, seen = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const parents = byId.get(id)?.parents ?? [];
    const d = parents.length ? Math.max(...parents.map((p) => depthOf(p, seen))) + 1 : 0;
    depth.set(id, d);
    return d;
  };
  people.forEach((p) => depthOf(p.id));
  for (let changed = true, guard = 0; changed && guard < people.length; guard++) {
    changed = false;
    for (const p of people) for (const q of p.partners) {
      const d = Math.max(depth.get(p.id)!, depth.get(q) ?? 0);
      if (depth.get(p.id) !== d) { depth.set(p.id, d); changed = true; }
    }
  }
  const rows: Person[][] = [];
  for (const p of people) (rows[depth.get(p.id)!] ??= []).push(p);
  return rows.filter(Boolean);
}

export interface Relatives {
  parents: Person[];
  children: Person[];
  partners: Person[];
  siblings: Person[];
}

export function relativesOf(people: Person[], id: string): Relatives {
  const me = people.find((p) => p.id === id);
  if (!me) return { parents: [], children: [], partners: [], siblings: [] };
  const byId = new Map(people.map((p) => [p.id, p]));
  const partnerIds = new Set([...me.partners, ...people.filter((p) => p.partners.includes(id)).map((p) => p.id)]);
  return {
    parents: me.parents.map((x) => byId.get(x)!).filter(Boolean),
    children: people.filter((p) => p.parents.includes(id)),
    partners: [...partnerIds].map((x) => byId.get(x)!).filter(Boolean),
    siblings: me.parents.length ? people.filter((p) => p.id !== id && p.parents.some((x) => me.parents.includes(x))) : [],
  };
}

export type Step = { from: string; to: string; relation: "parent of" | "child of" | "partner of" };

/** Shortest chain of family ties between two people, or null if unconnected. */
export function connection(people: Person[], a: string, b: string): Step[] | null {
  if (a === b) return [];
  const edges = new Map<string, Step[]>();
  const add = (s: Step) => edges.set(s.from, [...(edges.get(s.from) ?? []), s]);
  for (const p of people) {
    for (const parent of p.parents) {
      add({ from: parent, to: p.id, relation: "parent of" });
      add({ from: p.id, to: parent, relation: "child of" });
    }
    for (const q of p.partners) {
      add({ from: p.id, to: q, relation: "partner of" });
      add({ from: q, to: p.id, relation: "partner of" });
    }
  }
  const prev = new Map<string, Step>();
  const queue = [a];
  const seen = new Set([a]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const s of edges.get(cur) ?? []) {
      if (seen.has(s.to)) continue;
      seen.add(s.to);
      prev.set(s.to, s);
      if (s.to === b) {
        const path: Step[] = [];
        for (let x = b; x !== a; x = prev.get(x)!.from) path.unshift(prev.get(x)!);
        return path;
      }
      queue.push(s.to);
    }
  }
  return null;
}

export function describeConnection(people: Person[], path: Step[]): string {
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  if (path.length === 0) return "That's the same person.";
  return path.map((s) => `${name(s.from)} is ${s.relation} ${name(s.to)}`).join("; ") + ".";
}

/** People who appear in a given work (for the canon switch and work pages). */
export function peopleInWork(people: Person[], slug: string): Person[] {
  return people.filter((p) => p.appearsIn.includes(slug));
}

/** C58: "Find a person" — every word of the query starts a word of the name (case and accents ignored). */
export function findPeople(people: Person[], query: string): Set<string> {
  const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const words = fold(query).split(" ").filter(Boolean);
  return new Set(people.filter((p) => { const n = ` ${fold(p.name)} `; return words.every((w) => n.includes(` ${w}`)); }).map((p) => p.id));
}
