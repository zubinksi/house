/*
 * The order the sidebar shows its list in (stars first, then the filter and
 * sort), shared with the panel's drum so rolling it steps through the same
 * list. Markets and addresses each keep their own.
 */
import { useSyncExternalStore } from 'react';

type Kind = 'markets' | 'addresses';
const lists: Record<Kind, string[]> = { markets: [], addresses: [] };
const listeners = new Set<() => void>();

export function setOrder(kind: Kind, names: string[]) {
  const cur = lists[kind];
  if (cur.length === names.length && cur.every((n, i) => n === names[i])) return;
  lists[kind] = names;
  listeners.forEach((l) => l());
}

export function useOrder(kind: Kind): string[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => lists[kind],
  );
}
