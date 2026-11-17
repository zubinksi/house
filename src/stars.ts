/*
 * Starred markets and addresses, kept on this device. Starred markets lead the
 * sidebar's list; starred addresses make up the address list.
 */
import { useSyncExternalStore } from 'react';

export type StarKind = 'markets' | 'addresses';

const key = (kind: StarKind) => `house.stars.${kind}`;
const cache: Record<StarKind, string[]> = { markets: read('markets', ['HYPE']), addresses: read('addresses', []) };
const listeners = new Set<() => void>();

function read(kind: StarKind, fallback: string[]): string[] {
  try {
    const raw = localStorage.getItem(key(kind));
    if (raw) {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
    }
  } catch {
    // private window or blocked storage: stars last for the visit
  }
  return fallback;
}

function write(kind: StarKind, list: string[]) {
  cache[kind] = list;
  try {
    localStorage.setItem(key(kind), JSON.stringify(list));
  } catch {
    // as above
  }
  listeners.forEach((l) => l());
}

export function toggleStar(kind: StarKind, id: string) {
  const list = cache[kind];
  write(kind, list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
}

/** The starred ids of one kind, in the order they were starred. */
export function useStars(kind: StarKind): string[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => cache[kind],
  );
}
